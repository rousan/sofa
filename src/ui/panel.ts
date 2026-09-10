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
   * Resolve the pull request's head commit sha.
   *
   * @param ctx - The pull request being reviewed.
   */
  resolveHeadSha: (ctx: PrContext) => Promise<string | null>;
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
 * Find the element after which GitHub renders the pull request tab's content.
 *
 * The tab bar and the content are siblings, but how deeply the bar is wrapped
 * differs between github.com and Enterprise releases, so this climbs from the
 * bar until it reaches a node that actually has content after it.
 *
 * @param anchor - Any element inside the pull request tab bar.
 * @returns The marker element, or null when the layout could not be read.
 */
function findContentMarker(anchor: Element | null | undefined): Element | null {
  if (!anchor) return null;
  let node: Element = anchor.closest('nav, [role="tablist"], .tabnav-tabs') ?? anchor;
  while (!node.nextElementSibling) {
    const parent: Element | null = node.parentElement;
    // Stop before escaping the page's content region; body-level siblings are
    // scripts and dialogs, not the tab's content.
    if (!parent || parent === document.body || parent.tagName === 'BODY') return null;
    node = parent;
  }
  return node;
}

/**
 * Hide GitHub's own tab content and put the panel in its place.
 *
 * Nothing is removed: each hidden sibling keeps its previous inline `display`
 * so `restoreSiblings` can put the page back exactly as it was.
 *
 * @param element - The panel's root element.
 * @param marker - The element returned by `findContentMarker`.
 * @returns The siblings that were hidden, with the styles to restore.
 */
function takeOverContent(element: HTMLElement, marker: Element): { node: HTMLElement; display: string }[] {
  const hidden: { node: HTMLElement; display: string }[] = [];
  let sibling = marker.nextElementSibling;
  while (sibling) {
    const next = sibling.nextElementSibling;
    if (sibling !== element && sibling instanceof HTMLElement) {
      hidden.push({ node: sibling, display: sibling.style.display });
      sibling.style.display = 'none';
    }
    sibling = next;
  }
  marker.parentElement?.insertBefore(element, marker.nextSibling);
  return hidden;
}

/**
 * Give the page back the content that `takeOverContent` hid.
 *
 * @param hidden - The record returned by `takeOverContent`.
 */
function restoreSiblings(hidden: { node: HTMLElement; display: string }[]): void {
  for (const entry of hidden) {
    entry.node.style.display = entry.display;
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
    renderSidebar();

    const token = ++loadToken;
    if (!models.has(path)) {
      setViewerMessage(`Loading ${path}`);
      const needsHead = !file.binary && file.status !== 'deleted';
      const headText = needsHead ? await source.fetchFileAtSha(ctx, headSha, file.path) : null;
      // A newer selection landed while this file was in flight.
      if (token !== loadToken) return;
      models.set(path, buildFileModel(file, headText));
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
        renderSidebar();
      },
      onModeChange: (nextMode) => {
        mode = nextMode;
        void selectFile(path);
      },
    });
    prefetchNeighbour(path);
  }

  /**
   * Warm the cache for the file after the current one.
   *
   * @param path - The path currently displayed.
   */
  function prefetchNeighbour(path: string): void {
    const order = files.map((file) => file.path);
    const next = order[order.indexOf(path) + 1];
    if (!next) return;
    const file = files.find((entry) => entry.path === next);
    if (!file || file.binary || file.status === 'deleted' || models.has(next)) return;
    void source.fetchFileAtSha(ctx, headSha, next);
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
    } catch (err) {
      loaded = false;
      setBanner(`Could not load the diff: ${err instanceof Error ? err.message : String(err)}`);
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
  let hiddenSiblings: { node: HTMLElement; display: string }[] = [];

  const panel: Panel = {
    ctx,
    open(anchor) {
      const marker = findContentMarker(anchor ?? options.anchor ?? null);
      if (marker) {
        // Inline: stand in for GitHub's own tab content, leaving its tab bar,
        // header and navigation untouched above.
        element.classList.add('sofa-root--inline');
        element.classList.remove('sofa-root--overlay');
        document.documentElement.classList.remove('sofa-locked');
        if (element.previousElementSibling !== marker) {
          restoreSiblings(hiddenSiblings);
          hiddenSiblings = takeOverContent(element, marker);
        }
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
      restoreSiblings(hiddenSiblings);
      panel.onClose?.();
    },
    isOpen() {
      return element.classList.contains('is-open');
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown, true);
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
