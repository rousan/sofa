/**
 * The Sofa overlay: toolbar, resizable sidebar and file viewer.
 *
 * The panel owns all review state for one pull request (which files exist, which
 * one is selected, which are marked viewed) and drives the viewer whenever that
 * state changes. It is created on first open and then reused, so returning to
 * the Sofa tab does not refetch the diff.
 */
import { debounce, el, formatCount, loadViewed, readSetting, saveViewed, writeSetting } from '../util.ts';
import { buildTree, flattenPaths, renderTree } from './tree.ts';
import { renderFile } from './viewer.ts';
import { buildFileModel } from '../model.ts';
import * as forge from '../github.ts';
import type { DiffFile, FileModel, PrContext, ViewMode } from '../types.ts';
import type { ViewerHandle } from './viewer.ts';

/**
 * Sidebar width bounds, in pixels, honoured by the drag handle.
 */
const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 720;

/**
 * Storage key holding the user's chosen sidebar width.
 */
const WIDTH_KEY = 'sofa:sidebarWidth';

/**
 * How many files to fetch at once while warming the cache.
 *
 * Enough to hide the latency of a click, few enough to leave the browser's
 * connection budget for whatever the user actually asked for.
 */
const PREFETCH_CONCURRENCY = 4;

/**
 * The forge calls the panel depends on.
 *
 * Declaring them as an interface lets `test/harness.html` render the panel from
 * a fixture, with no network and no pull request.
 */
export interface DiffSource {
  /**
   * Fetch the pull request's changed files.
   *
   * @param ctx - The pull request being reviewed.
   */
  fetchFiles: (ctx: PrContext) => Promise<DiffFile[]>;
  /**
   * Resolve the pull request's head commit sha, cheaply and possibly wrongly.
   *
   * @param ctx - The pull request being reviewed.
   */
  resolveHeadSha: (ctx: PrContext) => Promise<string | null>;
  /**
   * Resolve the head commit sha authoritatively, at the cost of a request.
   *
   * @param ctx - The pull request being reviewed.
   */
  confirmHeadSha: (ctx: PrContext) => Promise<string | null>;
  /**
   * Fetch one file's full text at a commit.
   *
   * @param ctx - The pull request being reviewed.
   * @param sha - Commit to read at.
   * @param path - Repository-relative path.
   */
  fetchFileAtSha: (ctx: PrContext, sha: string | null, path: string) => Promise<string | null>;
}

/**
 * Options accepted when opening the panel.
 */
export interface PanelOptions {
  /** Called after the user closes the panel, so the tab can be deactivated. */
  onClose?: () => void;
  /** Overrides the live forge calls; used by the offline harness. */
  source?: DiffSource;
  /**
   * The pull request's tab bar. When given, the panel replaces the page content
   * below it, which is what makes Sofa behave like one of GitHub's own tabs; if
   * it is absent, or the surrounding layout cannot be read, the panel falls back
   * to a full-viewport overlay.
   */
  anchor?: Element | null;
  /**
   * Finds the tab bar again after the page has re-rendered and thrown the
   * previous one away.
   */
  findAnchor?: () => Element | null;
  /** Called with the file count once the diff has loaded, for the tab counter. */
  onFileCount?: (count: number) => void;
}

/**
 * The public surface of a panel instance.
 */
export interface Panel {
  /** Mount the panel and load its data if it has not loaded yet. */
  open: (anchor?: Element | null) => void;
  /** Hide the panel and hand the page back to GitHub. */
  close: () => void;
  /** Whether the panel is visible right now. */
  isOpen: () => boolean;
  /** Remove the panel and its document listeners. */
  destroy: () => void;
  /** The pull request this panel was built for. */
  ctx: PrContext;
  /** Called after the user closes the panel. */
  onClose?: () => void;
  /** Called with the file count once the diff has loaded. */
  onFileCount?: (count: number) => void;
}

/**
 * The live panel, or null before the first open.
 */
let instance: Panel | null = null;

/**
 * Turn a failed diff fetch into something the reader can act on.
 *
 * The status codes each mean something specific here, and a bare number sends
 * people looking in the wrong place: a 403 is almost always the forge throttling
 * repeated .diff downloads rather than a permissions problem, and a 404 on a
 * page that plainly exists means the session is not being sent.
 *
 * @param err - Whatever the load threw.
 * @returns A sentence for the banner.
 */
function describeLoadFailure(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.startsWith('403')) {
    return `Could not load the diff (${message.trim()}). The forge refused it, usually because it is `
      + 'throttling repeated diff downloads. Wait a moment, then use Reload diff.';
  }
  if (message.startsWith('404')) {
    return `Could not load the diff (${message.trim()}). The pull request was not found, which usually `
      + 'means the session has expired; reload the page and sign in again.';
  }
  return `Could not load the diff: ${message}`;
}

/**
 * Where the panel goes, and what it stands in for.
 */
interface MountPlan {
  /** Page regions to hide while the panel is open. */
  hide: HTMLElement[];
  /** The element the panel is inserted into. */
  parent: Element;
  /** The node the panel is inserted before, or null to append. */
  before: Node | null;
}

/**
 * The containers GitHub renders a pull request tab's content into.
 *
 * Both generations are listed: the older buckets, still used by Enterprise, and
 * the page-layout regions of the current github.com, whose main column and
 * sidebar are separate regions that must both give way.
 */
const CONTENT_REGION_SELECTORS = [
  '#files_bucket',
  '#discussion_bucket',
  '.pull-request-tab-content',
  '[class*="PageLayout-Content"]',
  '[class*="PageLayout-Pane"]',
];

/**
 * Order elements the way they appear in the document.
 *
 * @param elements - Elements to sort, in any order.
 * @returns The same elements, first in the document first.
 */
function inDocumentOrder(elements: HTMLElement[]): HTMLElement[] {
  return [...elements].sort((a, b) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ? -1 : 1);
}

/**
 * Work out where to put the panel and what it stands in for.
 *
 * Naming the content regions directly is what keeps this honest. Walking up
 * from the tab bar until a sibling appeared, which is what the fallback below
 * still does, lands inside the page header on current github.com: the panel
 * mounts there and the conversation goes on rendering underneath it.
 *
 * @param anchor - Any element inside the pull request tab bar.
 * @param panel - The panel's own root, which no region may be measured against.
 * @returns The plan, or null when the layout could not be read.
 */
function findMountPlan(anchor: Element | null | undefined, panel: HTMLElement): MountPlan | null {
  if (!anchor) return null;

  const matches = CONTENT_REGION_SELECTORS
    .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
    // A region containing the tab bar is the page's frame, not the tab's content.
    .filter((element) => !element.contains(anchor))
    // Once mounted, the panel sits inside one of these regions. Including an
    // ancestor of the panel would make the plan un-satisfiable: it can never be
    // hidden without hiding the panel, so it would read as permanently wrong and
    // the panel would be re-mounted on every mutation, for ever.
    .filter((element) => element !== panel && !element.contains(panel));
  const outermost = inDocumentOrder(
    matches.filter((element) => !matches.some((other) => other !== element && other.contains(element))),
  );

  const first = outermost[0];
  if (first?.parentElement) {
    return { hide: outermost, parent: first.parentElement, before: first };
  }

  let node: Element = anchor.closest('nav, [role="tablist"], .tabnav-tabs') ?? anchor;
  while (!node.nextElementSibling) {
    const parent: Element | null = node.parentElement;
    // Stop before escaping the page's content region; body-level siblings are
    // scripts and dialogs, not the tab's content.
    if (!parent || parent === document.body) return null;
    node = parent;
  }
  const parent = node.parentElement;
  if (!parent) return null;
  const hide: HTMLElement[] = [];
  let sibling: Element | null = node.nextElementSibling;
  while (sibling) {
    if (sibling instanceof HTMLElement) hide.push(sibling);
    sibling = sibling.nextElementSibling;
  }
  return { hide, parent, before: node.nextSibling };
}

/**
 * Hide the page's own content and put the panel in its place.
 *
 * Hiding and mounting are deliberately separate. GitHub goes on re-rendering
 * the region it is no longer showing, so freshly created nodes have to be
 * hidden again and again, but the panel itself must only move when it is
 * genuinely in the wrong place: moving it between a mousedown and a mouseup
 * destroys the click, which is exactly how a tree row stops responding.
 *
 * Nothing is removed: each hidden element keeps its previous inline `display`
 * so `restoreSiblings` can put the page back exactly as it was.
 *
 * @param element - The panel's root element.
 * @param plan - Where to mount, from `findMountPlan`.
 * @param hidden - Running record of hidden elements, appended to in place.
 */
function applyMountPlan(
  element: HTMLElement,
  plan: MountPlan,
  hidden: { node: HTMLElement; display: string }[],
): void {
  for (const node of plan.hide) {
    if (node === element || node.contains(element) || node.style.display === 'none') continue;
    hidden.push({ node, display: node.style.display });
    node.style.display = 'none';
  }
  if (!element.isConnected || element.parentElement !== plan.parent) {
    plan.parent.insertBefore(element, plan.before);
  }
}

/**
 * Give the page back the content that `applyMountPlan` hid.
 *
 * @param hidden - The record built up by `applyMountPlan`.
 */
function restoreSiblings(hidden: { node: HTMLElement; display: string }[]): void {
  for (const entry of hidden) {
    if (entry.node.isConnected) entry.node.style.display = entry.display;
  }
  hidden.length = 0;
}

/**
 * Create a panel for one pull request.
 *
 * @param ctx - The pull request to review.
 * @param options - Close callback and optional forge override.
 * @returns The panel instance.
 */
function createPanel(ctx: PrContext, options: PanelOptions): Panel {
  const source: DiffSource = options.source ?? forge;

  let files: DiffFile[] = [];
  let headSha: string | null = null;
  let selectedPath: string | null = null;
  let filter = '';
  let mode: ViewMode = 'full';
  let viewerHandle: ViewerHandle | null = null;
  let loadToken = 0;
  let loaded = false;
  // Whether the head sha has been checked against its authoritative source,
  // which only happens once, and only if a file turns out not to match.
  let headShaConfirmed = false;
  // Bumped whenever the diff is reloaded, so an in-flight prefetch for the old
  // revision stops instead of filling the cache with stale text.
  let prefetchToken = 0;
  const viewed = loadViewed(ctx);
  const collapsed = new Set<string>();
  const models = new Map<string, FileModel>();

  const filterInput = el('input', {
    className: 'sofa-filter',
    attrs: { type: 'search', placeholder: 'Filter files', 'aria-label': 'Filter changed files' },
  });
  const treeMount = el('div', { className: 'sofa-tree-mount' });
  const sidebarMeta = el('div', { className: 'sofa-sidebar-meta' });
  const sidebar = el('aside', {
    className: 'sofa-sidebar',
    children: [
      el('div', { className: 'sofa-sidebar-head', children: [filterInput] }),
      treeMount,
      sidebarMeta,
      el('div', {
        className: 'sofa-shortcuts',
        text: 'n / p change · [ / ] file · w whole file · v viewed · / filter · esc close',
      }),
    ],
  });

  const resizer = el('div', { className: 'sofa-resizer', attrs: { 'aria-hidden': 'true' } });
  const viewerMount = el('main', { className: 'sofa-main' });
  const toolbarMeta = el('div', { className: 'sofa-toolbar-meta' });
  const reloadButton = el('button', { className: 'sofa-btn', text: 'Reload diff', attrs: { type: 'button', title: 'Refetch the pull request diff' } });
  const closeButton = el('button', { className: 'sofa-btn sofa-btn--primary', text: 'Close', attrs: { type: 'button', title: 'Back to GitHub (esc)' } });
  const banner = el('div', { className: 'sofa-banner' });
  banner.hidden = true;

  const element = el('div', {
    className: 'sofa-root',
    attrs: { 'data-sofa': 'panel' },
    children: [
      el('header', {
        className: 'sofa-toolbar',
        children: [
          el('div', {
            className: 'sofa-title',
            children: [
              el('span', { className: 'sofa-logo', text: 'Sofa' }),
              el('span', { className: 'sofa-subject', text: `${ctx.owner}/${ctx.repo} #${ctx.number}` }),
            ],
          }),
          toolbarMeta,
          el('div', { className: 'sofa-toolbar-actions', children: [reloadButton, closeButton] }),
        ],
      }),
      banner,
      el('div', { className: 'sofa-body', children: [sidebar, resizer, viewerMount] }),
    ],
  });

  const storedWidth = Number(readSetting(WIDTH_KEY) ?? 0);
  if (storedWidth >= MIN_SIDEBAR && storedWidth <= MAX_SIDEBAR) sidebar.style.width = `${storedWidth}px`;

  /**
   * Show or hide the banner above the panel body.
   *
   * @param message - Message to show; an empty string hides the banner.
   */
  function setBanner(message: string): void {
    banner.textContent = message;
    banner.hidden = !message;
  }

  /**
   * Replace the viewer area with a single status line.
   *
   * @param message - Text to show while loading or when there is nothing to show.
   */
  function setViewerMessage(message: string): void {
    viewerMount.textContent = '';
    viewerMount.appendChild(el('p', { className: 'sofa-empty', text: message }));
  }

  /**
   * The files matching the current filter text.
   *
   * @returns The filtered file records.
   */
  function filteredFiles(): DiffFile[] {
    const needle = filter.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.path.toLowerCase().includes(needle));
  }

  /**
   * Move the selected highlight without rebuilding the tree.
   *
   * Rebuilding it on every click throws away and recreates a row per changed
   * file, which is wasted work on a large pull request and makes the click feel
   * heavier than it is.
   *
   * @param path - The path that is now open.
   */
  function updateSelection(path: string): void {
    for (const row of treeMount.querySelectorAll<HTMLElement>('[data-sofa-path]')) {
      row.classList.toggle('is-selected', row.dataset['sofaPath'] === path);
    }
  }

  /**
   * Reflect one file's viewed state in the tree and the counter.
   *
   * @param path - The file whose state changed.
   */
  function updateViewed(path: string): void {
    const row = treeMount.querySelector<HTMLElement>(`[data-sofa-path="${CSS.escape(path)}"]`);
    row?.classList.toggle('is-viewed', viewed.has(path));
    const count = files.filter((file) => viewed.has(file.path)).length;
    sidebarMeta.textContent = `${count} / ${files.length} viewed`;
  }

  /**
   * Redraw the sidebar tree and the two meta lines from current state.
   */
  function renderSidebar(): void {
    const tree = renderTree({
      files: filteredFiles(),
      selectedPath,
      viewed,
      collapsed,
      onSelect: (path) => void selectFile(path),
      onToggleDir: (path) => {
        if (collapsed.has(path)) collapsed.delete(path);
        else collapsed.add(path);
        renderSidebar();
      },
    });
    treeMount.textContent = '';
    treeMount.appendChild(tree);

    const additions = files.reduce((sum, file) => sum + file.additions, 0);
    const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
    toolbarMeta.textContent = '';
    toolbarMeta.append(
      el('span', { text: `${formatCount(files.length)} files` }),
      el('span', { className: 'sofa-add', text: `+${formatCount(additions)}` }),
      el('span', { className: 'sofa-del', text: `-${formatCount(deletions)}` }),
    );

    const viewedCount = files.filter((file) => viewed.has(file.path)).length;
    sidebarMeta.textContent = `${viewedCount} / ${files.length} viewed`;
  }

  /**
   * Build (or reuse) the row model for one file and render it.
   *
   * The head-revision text is fetched on first selection rather than up front,
   * which keeps opening the panel cheap on a pull request with many files.
   *
   * @param path - Path of the file to show.
   */
  async function selectFile(path: string): Promise<void> {
    const file = files.find((entry) => entry.path === path);
    if (!file) return;
    selectedPath = path;
    updateSelection(path);

    const token = ++loadToken;
    if (!models.has(path)) {
      setViewerMessage(`Loading ${path}`);
      try {
        const needsHead = !file.binary && file.status !== 'deleted';
        let model = buildFileModel(file, needsHead ? await source.fetchFileAtSha(ctx, headSha, file.path) : null);

        // The file did not match the diff, so the sha it was fetched at was the
        // wrong one. Confirm the head sha against the pull request's own patch
        // and try again before settling for a hunks-only rendering.
        if (model.mismatch && !headShaConfirmed) {
          headShaConfirmed = true;
          const confirmed = await source.confirmHeadSha(ctx);
          if (confirmed && confirmed !== headSha) {
            headSha = confirmed;
            // Anything cached was built against the wrong revision.
            models.clear();
            model = buildFileModel(file, await source.fetchFileAtSha(ctx, headSha, file.path));
          }
        }

        // A newer selection landed while this file was in flight.
        if (token !== loadToken) return;
        models.set(path, model);
      } catch (err) {
        // Without this the viewer would sit on "Loading" for ever, with the
        // reason only visible in the console.
        if (token !== loadToken) return;
        setViewerMessage(`Could not open ${path}: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    const model = models.get(path);
    if (!model) return;
    viewerHandle = renderFile(viewerMount, {
      file,
      model,
      ctx,
      headSha,
      mode,
      isViewed: viewed.has(path),
      onToggleViewed: (target, isViewed) => {
        if (isViewed) viewed.add(target);
        else viewed.delete(target);
        saveViewed(ctx, viewed);
        updateViewed(target);
      },
      onModeChange: (nextMode) => {
        mode = nextMode;
        void selectFile(path);
      },
    });
  }

  /**
   * Fetch every file's text in the background, a few at a time.
   *
   * Clicking a file should feel instant, and it only does if the text is
   * already there: the fetch is the whole of the delay. Requests are capped so
   * a large pull request does not open dozens of connections at once, and the
   * fetch layer collapses a click onto an in-flight prefetch rather than
   * starting a second request for the same file.
   */
  async function prefetchAll(): Promise<void> {
    const queue = files
      .filter((file) => !file.binary && file.status !== 'deleted')
      .map((file) => file.path);
    const token = prefetchToken;

    /**
     * Take paths off the shared queue until it runs dry.
     */
    async function worker(): Promise<void> {
      for (let next = queue.shift(); next; next = queue.shift()) {
        // A reload or a different pull request happened; stop wasting requests.
        if (token !== prefetchToken) return;
        await source.fetchFileAtSha(ctx, headSha, next);
      }
    }

    await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, () => worker()));
  }

  /**
   * Move the selection by one file in the sidebar's display order.
   *
   * @param direction - `1` for the next file, `-1` for the previous one.
   */
  function moveFile(direction: number): void {
    const order = flattenPaths(buildTree(filteredFiles()));
    if (!order.length) return;
    let next = order.indexOf(selectedPath ?? '') + direction;
    if (next < 0) next = order.length - 1;
    if (next >= order.length) next = 0;
    const target = order[next];
    if (target) void selectFile(target);
  }

  /**
   * Fetch the diff and the head sha, then show the first file.
   *
   * @param force - Discard anything already loaded and start again.
   */
  async function load(force: boolean): Promise<void> {
    if (loaded && !force) return;
    loaded = true;
    models.clear();
    setBanner('');
    setViewerMessage('Loading diff');

    try {
      const [nextFiles, nextSha] = await Promise.all([source.fetchFiles(ctx), source.resolveHeadSha(ctx)]);
      files = nextFiles;
      headSha = nextSha;
      if (!nextSha) setBanner('Could not determine the head commit, so files are shown as diff hunks only.');
      renderSidebar();
      panel.onFileCount?.(files.length);
      const first = files[0];
      if (first) await selectFile(first.path);
      else setViewerMessage('This pull request has no file changes.');
      // Only once something is on screen, so the first file is never queued
      // behind the rest.
      prefetchToken++;
      void prefetchAll();
    } catch (err) {
      loaded = false;
      setBanner(describeLoadFailure(err));
      viewerMount.textContent = '';
    }
  }

  filterInput.addEventListener('input', debounce(() => {
    filter = filterInput.value;
    renderSidebar();
  }, 120));

  reloadButton.addEventListener('click', () => void load(true));
  closeButton.addEventListener('click', () => panel.close());

  resizer.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebar.getBoundingClientRect().width;

    /**
     * Apply the drag delta to the sidebar width.
     *
     * @param moveEvent - The active mousemove event.
     */
    function onMove(moveEvent: MouseEvent): void {
      const width = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + moveEvent.clientX - startX));
      sidebar.style.width = `${width}px`;
    }

    /**
     * Stop dragging and remember the chosen width.
     */
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      writeSetting(WIDTH_KEY, String(Math.round(sidebar.getBoundingClientRect().width)));
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  /**
   * Handle the panel's keyboard shortcuts.
   *
   * Captured on the document so GitHub's own shortcuts do not also fire, and
   * ignored entirely while the user is typing in a field.
   *
   * @param event - The key event.
   */
  function onKeyDown(event: KeyboardEvent): void {
    if (!panel.isOpen()) return;
    const target = event.target as HTMLElement | null;
    const isTyping = Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable));

    if (event.key === 'Escape') {
      if (isTyping) return;
      panel.close();
      return;
    }
    if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === 'n') viewerHandle?.jumpToChange(1);
    else if (event.key === 'p') viewerHandle?.jumpToChange(-1);
    else if (event.key === ']' || event.key === 'j') moveFile(1);
    else if (event.key === '[' || event.key === 'k') moveFile(-1);
    else if (event.key === 'w') {
      mode = mode === 'full' ? 'changes' : 'full';
      if (selectedPath) void selectFile(selectedPath);
    } else if (event.key === '/') {
      event.preventDefault();
      filterInput.focus();
      filterInput.select();
    } else if (event.key === 'v') {
      if (!selectedPath) return;
      if (viewed.has(selectedPath)) viewed.delete(selectedPath);
      else viewed.add(selectedPath);
      saveViewed(ctx, viewed);
      void selectFile(selectedPath);
    } else {
      return;
    }
    event.stopPropagation();
  }

  document.addEventListener('keydown', onKeyDown, true);

  /**
   * Siblings currently hidden because the panel took their place in the page.
   */
  const hiddenSiblings: { node: HTMLElement; display: string }[] = [];

  /**
   * Finds the tab bar to mount against, called again on every re-mount.
   *
   * A stored element is no use here: React replaces the nav wholesale, so the
   * node that was found at open time is detached by the time it is needed.
   */
  const findAnchor = options.findAnchor ?? (() => null);

  /**
   * Watches the container the panel lives in.
   *
   * GitHub renders the pull request with React and re-renders that container on
   * its own schedule, which throws away anything injected into it. Without this,
   * the panel silently disappears mid-review.
   */
  let hostObserver: MutationObserver | null = null;

  /**
   * True while the panel is re-mounting itself.
   *
   * Moving the panel is itself a mutation, so without this the observer would
   * react to its own work.
   */
  let remounting = false;

  /**
   * Put the panel back if the page threw it away, and hide any content the page
   * re-added behind it.
   */
  function remountIfNeeded(): void {
    if (!panel.isOpen() || element.classList.contains('sofa-root--overlay') || remounting) return;
    const plan = findMountPlan(findAnchor(), element);
    if (!plan) return;
    // A re-render replaces the regions wholesale, so a hidden one that is no
    // longer in the document, or a fresh one that is not hidden yet, means the
    // page has put its own content back.
    // Only a region that is visible and is not an ancestor of the panel counts
    // as the page having taken its content back.
    const uncovered = plan.hide.some((node) => node.style.display !== 'none'
      && node !== element && !node.contains(element));
    if (!element.isConnected || element.parentElement !== plan.parent || uncovered) {
      remounting = true;
      try {
        applyMountPlan(element, plan, hiddenSiblings);
      } finally {
        remounting = false;
      }
    }
  }

  /**
   * Watch the document for the page replacing the panel's container.
   *
   * The whole body is watched rather than one container, because a React
   * re-render can replace any ancestor, taking the container with it. The
   * callback is debounced and does nothing but a connectivity check, so the
   * breadth costs little.
   */
  function watchHost(): void {
    hostObserver?.disconnect();
    hostObserver = new MutationObserver(debounce(remountIfNeeded, 150));
    hostObserver.observe(document.body, { childList: true, subtree: true });
  }

  const panel: Panel = {
    ctx,
    open(anchor) {
      const plan = findMountPlan(anchor ?? findAnchor(), element);
      if (plan) {
        // Inline: stand in for GitHub's own tab content, leaving its tab bar,
        // header and navigation untouched above.
        element.classList.add('sofa-root--inline');
        element.classList.remove('sofa-root--overlay');
        document.documentElement.classList.remove('sofa-locked');
        restoreSiblings(hiddenSiblings);
        applyMountPlan(element, plan, hiddenSiblings);
        watchHost();
      } else {
        // Fallback: an unreadable layout still gets a usable full-screen panel.
        element.classList.add('sofa-root--overlay');
        element.classList.remove('sofa-root--inline');
        if (!element.isConnected) document.body.appendChild(element);
        document.documentElement.classList.add('sofa-locked');
      }
      element.classList.add('is-open');
      void load(false);
    },
    close() {
      element.classList.remove('is-open');
      document.documentElement.classList.remove('sofa-locked');
      hostObserver?.disconnect();
      hostObserver = null;
      restoreSiblings(hiddenSiblings);
      panel.onClose?.();
    },
    isOpen() {
      return element.classList.contains('is-open');
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown, true);
      hostObserver?.disconnect();
      hostObserver = null;
      restoreSiblings(hiddenSiblings);
      element.remove();
      document.documentElement.classList.remove('sofa-locked');
    },
  };

  panel.onClose = options.onClose;
  panel.onFileCount = options.onFileCount;
  return panel;
}

/**
 * Open the Sofa panel, reusing the existing one when it is the same pull request.
 *
 * @param ctx - The pull request to review.
 * @param options - Close callback and optional forge override.
 * @returns The live panel.
 */
export function openPanel(ctx: PrContext, options: PanelOptions = {}): Panel {
  const current = instance;
  const isSamePr = Boolean(current
    && current.ctx.owner === ctx.owner
    && current.ctx.repo === ctx.repo
    && current.ctx.number === ctx.number);

  let panel: Panel;
  if (current && isSamePr) {
    // Same pull request, so keep the loaded diff and only re-point the callbacks.
    current.onClose = options.onClose;
    current.onFileCount = options.onFileCount;
    panel = current;
  } else {
    current?.destroy();
    panel = createPanel(ctx, options);
  }
  instance = panel;
  panel.open(options.anchor ?? null);
  return panel;
}

/**
 * Close the panel if one is open.
 */
export function closePanel(): void {
  instance?.close();
}

/**
 * Whether a panel is open right now.
 *
 * @returns True while the overlay is visible.
 */
export function isPanelOpen(): boolean {
  return Boolean(instance?.isOpen());
}
