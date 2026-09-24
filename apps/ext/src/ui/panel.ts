/**
 * The Sofa overlay: toolbar, resizable sidebar and file viewer.
 *
 * The panel owns all review state for one pull request (which files exist, which
 * one is selected, which are marked viewed) and drives the viewer whenever that
 * state changes. It is created on first open and then reused, so returning to
 * the Sofa tab does not refetch the diff.
 */
import { buildFileModel, debounce, formatCount } from '@sofa/core';
import { el, loadViewed, readSetting, saveViewed, writeSetting } from '../util.ts';
import { buildTree, flattenPaths, renderTree } from './tree.ts';
import { renderFile } from './viewer.ts';
import { openReviewDialog } from './review-dialog.ts';
import { clearDraft, draftId, loadDraft, saveDraft } from '../draft.ts';
import * as forge from '../github.ts';
import type { DiffFile, FileModel, PrContext, ReviewThread, ViewMode } from '@sofa/core';
import type { CommentTarget, ReadError, ReviewEvent, WriteResult } from '../github.ts';
import type { ReviewDraft } from '../draft.ts';
import type { DiffLayout, ViewerHandle } from './viewer.ts';

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
 * Storage key holding the user's choice of side-by-side or unified.
 *
 * Kept because it is a reading habit rather than a per-file decision: someone
 * who reviews side by side wants that on every file, in every pull request.
 */
const LAYOUT_KEY = 'sofa:layout';

/**
 * Space kept between the panel and each edge of the window when it widens.
 */
const WIDE_GUTTER = 16;

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
   * Fetch the pull request's changed files and head commit.
   *
   * @param ctx - The pull request being reviewed.
   */
  fetchPullRequest: (ctx: PrContext) => Promise<{
    files: DiffFile[];
    headSha: string | null;
    error: ReadError | null;
  }>;
  /**
   * Fetch one file's full text at a commit.
   *
   * @param ctx - The pull request being reviewed.
   * @param sha - Commit to read at.
   * @param path - Repository-relative path.
   */
  fetchFileAtSha: (ctx: PrContext, sha: string | null, path: string) => Promise<string | null>;
  /**
   * Fetch the review threads already on the pull request.
   *
   * @param ctx - The pull request being reviewed.
   */
  fetchReviewThreads: (ctx: PrContext) => Promise<{ threads: ReviewThread[]; error: ReadError | null }>;
  /**
   * Publish one comment on a line.
   *
   * Optional, because the offline harness has no forge to write to.
   *
   * @param ctx - The pull request being reviewed.
   * @param headSha - The commit to anchor the comment to.
   * @param target - The file, line and side.
   * @param body - What the reviewer wrote.
   */
  postComment?: (
    ctx: PrContext,
    headSha: string,
    target: CommentTarget,
    body: string,
  ) => Promise<WriteResult<unknown>>;
  /**
   * Reply to an existing thread.
   *
   * @param ctx - The pull request being reviewed.
   * @param inReplyTo - Id of the comment being replied to.
   * @param body - What the reviewer wrote.
   */
  postReply?: (ctx: PrContext, inReplyTo: number, body: string) => Promise<WriteResult<unknown>>;
  /**
   * Submit a review, with every comment held back for it.
   *
   * @param ctx - The pull request being reviewed.
   * @param headSha - The commit the review is against.
   * @param event - Comment, approve or request changes.
   * @param body - The review summary.
   * @param comments - The pending line comments.
   */
  submitReview?: (
    ctx: PrContext,
    headSha: string,
    event: ReviewEvent,
    body: string,
    comments: { path: string; line: number; side: 'LEFT' | 'RIGHT'; body: string }[],
  ) => Promise<WriteResult<unknown>>;
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
  // Side by side unless the reader has said otherwise, because a rewritten line
  // is far easier to read opposite its replacement than above it.
  let layout: DiffLayout = readSetting(LAYOUT_KEY) === 'unified' ? 'unified' : 'split';
  let viewerHandle: ViewerHandle | null = null;
  let loadToken = 0;
  let loaded = false;
  // Whether the head sha has been checked against its authoritative source,
  // which only happens once, and only if a file turns out not to match.
  // Review threads for the whole pull request, fetched once alongside the diff.
  let threads: ReviewThread[] = [];
  // The review being written: comments held back, and the summary typed so far.
  let draft: ReviewDraft = { comments: [], summary: '' };
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
        text: 'n / p change · [ / ] file · s side by side · w whole file · v viewed · / filter · esc close',
      }),
    ],
  });

  const resizer = el('div', { className: 'sofa-resizer', attrs: { 'aria-hidden': 'true' } });
  const viewerMount = el('main', { className: 'sofa-main' });
  const toolbarMeta = el('div', { className: 'sofa-toolbar-meta' });
  const reloadButton = el('button', { className: 'sofa-btn', text: 'Reload diff', attrs: { type: 'button', title: 'Refetch the pull request diff' } });
  const reviewButton = el('button', {
    className: 'sofa-btn sofa-btn--go',
    text: 'Review changes',
    attrs: { type: 'button', title: 'Finish your review' },
  });
  const closeButton = el('button', { className: 'sofa-btn sofa-btn--primary', text: 'Close', attrs: { type: 'button', title: 'Back to GitHub (esc)' } });
  const banner = el('div', { className: 'sofa-banner' });
  banner.hidden = true;

  const toolbar = el('header', {
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
      el('div', { className: 'sofa-toolbar-actions', children: [reloadButton, reviewButton, closeButton] }),
    ],
  });

  const element = el('div', {
    className: 'sofa-root',
    attrs: { 'data-sofa': 'panel' },
    children: [
      toolbar,
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
   * Explain that a token is needed, and how to add one.
   *
   * This is the first thing a new user sees on a private repository, so it is
   * an onboarding step rather than an error: it says what to create, with which
   * two permissions, and where to put it.
   */
  function showTokenPrompt(): void {
    viewerMount.textContent = '';
    viewerMount.appendChild(el('div', {
      className: 'sofa-onboard',
      children: [
        el('h2', { className: 'sofa-onboard-title', text: 'Sofa needs a token to read this pull request' }),
        el('p', {
          className: 'sofa-onboard-body',
          text: 'Diffs, file contents and review comments come from the GitHub API, which takes a '
            + 'token rather than your browser session.',
        }),
        el('ol', {
          className: 'sofa-onboard-steps',
          children: [
            el('li', { html: 'Create a fine-grained token here with <strong>Contents: Read</strong> and <strong>Pull requests: Read and write</strong>. Write is what lets you leave review comments from Sofa.' }),
            el('li', { text: 'Click the Sofa icon in the browser toolbar.' }),
            el('li', { text: 'Paste the token beside this host and save.' }),
          ],
        }),
        el('a', {
          className: 'sofa-btn sofa-btn--primary sofa-onboard-action',
          text: 'Create a token',
          attrs: { href: `${ctx.origin}/settings/personal-access-tokens/new`, target: '_blank', rel: 'noreferrer' },
        }),
      ],
    }));
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
        // The sha comes from the pull request itself now, so a mismatch is no
        // longer something to recover from by guessing again: the model reports
        // it, and the file falls back to its hunks.
        const model = buildFileModel(file, needsHead ? await source.fetchFileAtSha(ctx, headSha, file.path) : null);

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
      threads,
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
      layout,
      onLayoutChange: (next) => {
        layout = next;
        writeSetting(LAYOUT_KEY, next);
        fitWidth();
        void selectFile(path);
      },
      drafts: draft.comments,
      hasPendingReview: draft.comments.length > 0,
      onAddComment: addComment,
      onDraftComment: draftComment,
      onReply: replyToThread,
      onDiscardDraft: discardDraft,
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
   * Keep the Review changes button showing how much is waiting.
   *
   * GitHub puts the count on the button itself, which is the only reminder a
   * reviewer gets that they have written something nobody can see yet.
   */
  function updateReviewButton(): void {
    const count = draft.comments.length;
    reviewButton.textContent = count ? `Review changes (${count})` : 'Review changes';
  }

  /**
   * Re-read the review comments after something has been posted.
   *
   * The forge assigns ids and timestamps, and a reply has to land in the right
   * thread, so the threads are refetched rather than patched up locally.
   */
  async function refreshThreads(): Promise<void> {
    const comments = await source.fetchReviewThreads(ctx);
    if (comments.error) return;
    threads = comments.threads;
    if (selectedPath) await selectFile(selectedPath);
  }

  /**
   * Publish one comment straight away.
   *
   * @param target - The file, line and side being commented on.
   * @param body - What the reviewer wrote.
   * @returns An error to show in the box, or null when it posted.
   */
  async function addComment(target: CommentTarget, body: string): Promise<string | null> {
    if (!headSha) return 'Sofa does not know which commit to attach this to. Reload the diff.';
    const post = source.postComment ?? forge.postComment;
    const result = await post(ctx, headSha, target, body);
    if (!result.ok) return result.error ?? 'The comment could not be posted.';
    await refreshThreads();
    return null;
  }

  /**
   * Hold a comment back for the review being written.
   *
   * @param target - The file, line and side being commented on.
   * @param body - What the reviewer wrote.
   * @returns Always null: keeping a draft cannot fail in a way worth showing.
   */
  async function draftComment(target: CommentTarget, body: string): Promise<string | null> {
    draft.comments.push({ id: draftId(), path: target.path, line: target.line, side: target.side, body });
    await saveDraft(ctx, draft);
    updateReviewButton();
    if (selectedPath) await selectFile(selectedPath);
    return null;
  }

  /**
   * Reply to an existing thread.
   *
   * @param inReplyTo - Id of the comment at the root of the thread.
   * @param body - What the reviewer wrote.
   * @returns An error to show in the box, or null when it posted.
   */
  async function replyToThread(inReplyTo: number, body: string): Promise<string | null> {
    const reply = source.postReply ?? forge.postReply;
    const result = await reply(ctx, inReplyTo, body);
    if (!result.ok) return result.error ?? 'The reply could not be posted.';
    await refreshThreads();
    return null;
  }

  /**
   * Drop one pending comment from the review.
   *
   * @param id - The draft comment's local id.
   */
  function discardDraft(id: string): void {
    draft.comments = draft.comments.filter((comment) => comment.id !== id);
    void saveDraft(ctx, draft);
    updateReviewButton();
    if (selectedPath) void selectFile(selectedPath);
  }

  /**
   * Open the finish dialog and, if it is submitted, send the review.
   */
  function openFinishDialog(): void {
    const close = openReviewDialog({
      host: element,
      summary: draft.summary,
      pending: draft.comments.length,
      onSummaryChange: (value) => {
        draft.summary = value;
        void saveDraft(ctx, draft);
      },
      onSubmit: async (event, body) => {
        if (!headSha) return 'Sofa does not know which commit to review. Reload the diff.';
        // GitHub refuses a review that says nothing at all, and the message it
        // gives back for it is not one a reviewer would act on.
        if (!body && draft.comments.length === 0 && event === 'COMMENT') {
          return 'Write a summary, or leave a comment on a line, before submitting.';
        }
        const submit = source.submitReview ?? forge.submitReview;
        const result = await submit(ctx, headSha, event, body, draft.comments.map((comment) => ({
          path: comment.path,
          line: comment.line,
          side: comment.side,
          body: comment.body,
        })));
        if (!result.ok) return result.error ?? 'The review could not be submitted.';

        draft = { comments: [], summary: '' };
        await clearDraft(ctx);
        updateReviewButton();
        close();
        await refreshThreads();
        return null;
      },
    });
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
      const result = await source.fetchPullRequest(ctx);
      if (result.error === 'needs-token') {
        loaded = false;
        showTokenPrompt();
        return;
      }
      if (result.error) {
        loaded = false;
        setBanner('Could not read this pull request from the forge. Use Reload diff to try again.');
        viewerMount.textContent = '';
        return;
      }

      files = result.files;
      headSha = result.headSha;
      renderSidebar();
      panel.onFileCount?.(files.length);

      const first = files[0];
      if (first) await selectFile(first.path);
      else setViewerMessage('This pull request has no file changes.');

      // Only once something is on screen, so the first file is never queued
      // behind the rest.
      prefetchToken++;
      void prefetchAll();

      void source.fetchReviewThreads(ctx).then((comments) => {
        threads = comments.threads;
        // Re-render the open file so its comments appear without a click.
        if (selectedPath && threads.length) void selectFile(selectedPath);
      });

      // A review left half-written survives a reload, so it is restored here
      // rather than lost the first time someone refreshes the page.
      void loadDraft(ctx).then((stored) => {
        draft = stored;
        updateReviewButton();
        if (selectedPath && draft.comments.length) void selectFile(selectedPath);
      });
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
  reviewButton.addEventListener('click', openFinishDialog);
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
    } else if (event.key === 's') {
      layout = layout === 'split' ? 'unified' : 'split';
      writeSetting(LAYOUT_KEY, layout);
      fitWidth();
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
        fitWidth();
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

  /**
   * Stretch the panel to the window's width while it shows the diff side by side.
   *
   * GitHub centres its content in a column around 1280px wide, which leaves each
   * half of a side-by-side diff with a few hundred pixels of code. The panel
   * stays in the page's flow, so the tab bar and header are untouched; it only
   * pulls its left edge out to the window's and widens to match. In the unified
   * view one column already fits, so the page's own width is kept.
   */
  function fitWidth(): void {
    // Measured from the natural position, so a stale offset cannot compound.
    element.style.left = '';
    element.style.width = '';
    element.style.flex = '';
    element.style.maxWidth = '';
    if (layout !== 'split' || !panel.isOpen() || !element.classList.contains('sofa-root--inline')) return;

    // clientWidth excludes the vertical scrollbar, which 100vw would not, so
    // the panel never makes the page scroll sideways.
    const target = document.documentElement.clientWidth - WIDE_GUTTER * 2;
    if (target <= element.getBoundingClientRect().width) return;

    // GitHub's container is a flex row on some pages, which would shrink the
    // panel straight back to the column it came from, and a max-width would
    // cap it; both are lifted for as long as the panel is wide.
    element.style.width = `${target}px`;
    element.style.flex = '0 0 auto';
    element.style.maxWidth = 'none';

    // The container may centre a child wider than itself, so the panel's
    // landing spot is only known once it is wide. It is then shifted with a
    // relative offset rather than a margin: an offset is applied after layout,
    // so the container cannot re-centre it the way it would redistribute a
    // margin, and one measurement gives the exact correction.
    const landed = element.getBoundingClientRect().left;
    element.style.left = `${WIDE_GUTTER - landed}px`;
  }

  window.addEventListener('resize', debounce(fitWidth, 100));

  /**
   * How far down the window GitHub's own pinned header reaches, if it has one.
   *
   * GitHub pins a compact pull request header to the top of the window once the
   * page scrolls, and anything of Sofa's pinned at the very top would slide
   * underneath it and be hidden. So the element under the top edge of the
   * window is checked, and if it or an ancestor is fixed or sticky and is not
   * part of Sofa, its bottom edge is where Sofa's pinned rows start instead.
   *
   * @returns The offset from the top of the window, in pixels.
   */
  function pinnedHeaderBottom(): number {
    const x = Math.max(1, element.getBoundingClientRect().left + 8);
    let bottom = 0;
    for (const hit of document.elementsFromPoint(x, 1)) {
      if (element.contains(hit)) continue;
      for (let node: Element | null = hit; node && node !== document.body; node = node.parentElement) {
        const position = getComputedStyle(node).position;
        if (position !== 'fixed' && position !== 'sticky') continue;
        const rect = node.getBoundingClientRect();
        // Only something actually sitting on the top edge counts, not a sticky
        // element further down the page that happens to share a column.
        if (rect.top <= 1 && rect.bottom > 0 && rect.bottom < window.innerHeight / 3) {
          bottom = Math.max(bottom, rect.bottom);
        }
        break;
      }
    }
    return Math.round(bottom);
  }

  let pinFrame = 0;

  /**
   * Keep Sofa's pinned rows below GitHub's, rechecked once per animation frame
   * while scrolling, since GitHub's header only appears part way down the page.
   */
  function updatePinnedOffset(): void {
    if (pinFrame) return;
    pinFrame = requestAnimationFrame(() => {
      pinFrame = 0;
      if (!panel.isOpen() || !element.classList.contains('sofa-root--inline')) return;
      element.style.setProperty('--sofa-top', `${pinnedHeaderBottom()}px`);
    });
  }

  window.addEventListener('scroll', updatePinnedOffset, { passive: true });

  // The file header and tree are pinned below the toolbar, so they need its
  // real height, which changes when the toolbar wraps on a narrow window.
  new ResizeObserver(() => {
    element.style.setProperty('--sofa-toolbar-h', `${toolbar.offsetHeight}px`);
  }).observe(toolbar);

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
      fitWidth();
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
