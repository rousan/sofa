/**
 * The right-hand pane: one file at a time, shown as the whole file with the
 * diff spliced into it.
 *
 * Rows are built as a single HTML string rather than through the DOM API,
 * because a real source file routinely runs to thousands of lines and the
 * difference is between an instant file switch and a visible stall.
 */
import {
  buildSplitRows,
  escapeHtml,
  formatCount,
  highlightLine,
  indexThreadsForFile,
  languageFor,
  newHighlightState,
  renderMarkdown,
  rowKey,
} from '@sofa/core';
import { el } from '../util.ts';
import { blobUrl } from '../github.ts';
import { createCompose } from './compose.ts';
import type { CommentTarget } from '../github.ts';
import type { DraftComment } from '../draft.ts';
import type { DiffFile, DiffSide, FileModel, PrContext, ReviewThread, Row, ViewMode } from '@sofa/core';

/**
 * Which way the diff is laid out.
 *
 * `split` is the side-by-side view - old revision left, new right - and
 * `unified` is the single column a diff is written as.
 */
export type DiffLayout = 'split' | 'unified';

/**
 * Above this many rows the viewer refuses to lay out the whole file and shows
 * only the changed regions, so a generated or vendored file cannot freeze the tab.
 */
const MAX_FULL_ROWS = 40000;

/**
 * How many unchanged lines to keep either side of a change in changes-only mode.
 */
const CHANGES_ONLY_PADDING = 6;

/**
 * Everything `renderFile` needs to draw one file and report interactions.
 */
export interface ViewerOptions {
  /** The file being shown. */
  file: DiffFile;
  /** Its rows, from `buildFileModel`. */
  model: FileModel;
  /** The pull request being reviewed. */
  ctx: PrContext;
  /** Head commit sha, used for the "open on GitHub" link. */
  headSha: string | null;
  /** Whether to lay out the whole file or only the changed regions. */
  mode: ViewMode;
  /** Side-by-side or one column. */
  layout: DiffLayout;
  /** Called when the layout toggle is used. */
  onLayoutChange: (layout: DiffLayout) => void;
  /** Whether this file is currently marked viewed. */
  isViewed: boolean;
  /** Called when the viewed checkbox changes. */
  onToggleViewed: (path: string, isViewed: boolean) => void;
  /** Called when the whole-file toggle is used. */
  onModeChange: (mode: ViewMode) => void;
  /** Review threads for the whole pull request, filtered here to this file. */
  threads: ReviewThread[];
  /** Comments written but not yet submitted, for the whole pull request. */
  drafts: DraftComment[];
  /** True once the review has comments waiting, which renames the buttons. */
  hasPendingReview: boolean;
  /**
   * Publish one comment immediately, as GitHub's "Add single comment" does.
   *
   * @param target - The file, line and side being commented on.
   * @param body - What was written.
   * @returns An error to show in the box, or null when it posted.
   */
  onAddComment: (target: CommentTarget, body: string) => Promise<string | null>;
  /**
   * Hold one comment back for the review being written.
   *
   * @param target - The file, line and side being commented on.
   * @param body - What was written.
   * @returns An error to show in the box, or null when it was kept.
   */
  onDraftComment: (target: CommentTarget, body: string) => Promise<string | null>;
  /**
   * Reply to an existing thread.
   *
   * @param inReplyTo - Id of the comment at the root of the thread.
   * @param body - What was written.
   * @returns An error to show in the box, or null when it posted.
   */
  onReply: (inReplyTo: number, body: string) => Promise<string | null>;
  /**
   * Drop a pending comment from the review.
   *
   * @param id - The draft comment's local id.
   */
  onDiscardDraft: (id: string) => void;
}

/**
 * The handle the panel keeps so the keyboard can drive a rendered file.
 */
export interface ViewerHandle {
  /**
   * Scroll the next or previous change block into view.
   *
   * @param direction - `1` for the next change, `-1` for the previous one.
   */
  jumpToChange: (direction: number) => void;
  /** The scrolling element holding the rows. */
  scroller: HTMLElement;
  /** The mode actually rendered, which can differ from the requested one. */
  renderedMode: ViewMode;
}

/**
 * Decide which row indexes are visible for the given display mode.
 *
 * @param rows - The file's rows.
 * @param mode - Either whole file or changes only.
 * @returns The visible indexes, or null when every row is visible.
 */
function visibleIndexes(rows: Row[], mode: ViewMode): Set<number> | null {
  if (mode === 'full') return null;
  const keep = new Set<number>();
  rows.forEach((row, index) => {
    if (row.kind !== 'add' && row.kind !== 'del' && row.kind !== 'separator') return;
    const from = Math.max(0, index - CHANGES_ONLY_PADDING);
    const to = Math.min(rows.length - 1, index + CHANGES_ONLY_PADDING);
    for (let i = from; i <= to; i++) keep.add(i);
  });
  return keep;
}

/**
 * Build the markup for every visible row of a file.
 *
 * @param rows - The file's rows.
 * @param path - File path, used to pick the highlighter language.
 * @param mode - Either whole file or changes only.
 * @returns The rows' HTML.
 */
function renderRows(
  rows: Row[],
  path: string,
  mode: ViewMode,
  threads: ReviewThread[],
  drafts: DraftComment[],
): string {
  const lang = languageFor(path);
  const state = newHighlightState();
  const keep = visibleIndexes(rows, mode);
  const { byRow } = indexThreadsForFile(threads, path);
  const draftsByRow = draftsByRowFor(drafts, path);
  const parts: string[] = [];
  let skipping = false;

  rows.forEach((row, index) => {
    // Every row is tokenised even when hidden, because the highlighter carries
    // block-comment state from line to line.
    const code = row.kind === 'separator' ? '' : highlightLine(row.text, lang, state);
    if (keep && !keep.has(index)) {
      skipping = true;
      return;
    }
    if (skipping) {
      parts.push('<div class="sofa-row sofa-row--skip"><span>unchanged lines hidden</span></div>');
      skipping = false;
    }
    if (row.kind === 'separator') {
      parts.push(`<div class="sofa-row sofa-row--sep"><span>${escapeHtml(row.text)}</span></div>`);
      return;
    }
    const sign = row.kind === 'add' ? '+' : row.kind === 'del' ? '-' : ' ';

    // A comment is anchored to the side of the diff the line actually exists
    // on: a deleted line only exists on the left, everything else on the right.
    const side: DiffSide | null = row.kind === 'del'
      ? (row.oldNo !== null ? 'LEFT' : null)
      : (row.newNo !== null ? 'RIGHT' : null);
    const line = side === 'LEFT' ? row.oldNo : row.newNo;
    const anchor = side && line !== null ? ` data-side="${side}" data-line="${line}"` : '';

    parts.push(
      `<div class="sofa-row sofa-row--${row.kind}" data-index="${index}"${anchor}>`
        + (anchor
          ? '<button type="button" class="sofa-row-comment" title="Add a comment on this line"'
            + ' aria-label="Add a comment on this line">+</button>'
          : '')
        + `<span class="sofa-gutter">${row.oldNo ?? ''}</span>`
        + `<span class="sofa-gutter">${row.newNo ?? ''}</span>`
        + `<span class="sofa-sign">${sign}</span>`
        + `<span class="sofa-code">${code}</span>`
        + '</div>',
    );

    // A comment belongs under the line it was written against, whichever side
    // of the diff that line is on.
    const here = [
      ...(row.newNo !== null ? byRow.get(rowKey('RIGHT', row.newNo)) ?? [] : []),
      ...(row.oldNo !== null && row.kind === 'del' ? byRow.get(rowKey('LEFT', row.oldNo)) ?? [] : []),
    ];
    for (const thread of here) parts.push(renderThread(thread));

    if (side && line !== null) {
      for (const draft of draftsByRow.get(rowKey(side, line)) ?? []) {
        parts.push(renderDraft(draft));
      }
    }
  });

  return parts.join('');
}

/**
 * Group a file's draft comments by the row they belong to.
 *
 * @param drafts - Every pending comment in the pull request.
 * @param path - The file being rendered.
 * @returns Pending comments keyed the same way threads are.
 */
function draftsByRowFor(drafts: DraftComment[], path: string): Map<string, DraftComment[]> {
  const byRow = new Map<string, DraftComment[]>();
  for (const draft of drafts) {
    if (draft.path !== path) continue;
    const key = rowKey(draft.side, draft.line);
    const list = byRow.get(key);
    if (list) list.push(draft);
    else byRow.set(key, [draft]);
  }
  return byRow;
}

/**
 * Render one side of a side-by-side row.
 *
 * A side with no row is a filler: the other column added or removed a line, and
 * this one has nothing at that point. It is drawn as an inert striped cell so
 * the eye can see that the file has no counterpart there, rather than a blank
 * that reads as an empty line of code.
 *
 * @param row - The line to draw, or null for a filler.
 * @param side - Which revision this column shows.
 * @param code - The line's already-highlighted markup.
 * @returns The cell's markup.
 */
function renderSide(row: Row | null, side: DiffSide, code: string): string {
  if (!row) {
    return `<span class="sofa-gutter sofa-gutter--none"></span>`
      + '<span class="sofa-side sofa-side--none"></span>';
  }

  const number = side === 'LEFT' ? row.oldNo : row.newNo;
  const kind = row.kind === 'add' || row.kind === 'del' ? row.kind : 'ctx';
  // A line only takes a comment where it actually exists, which is what having
  // a number on this side means.
  const anchor = number !== null ? ` data-side="${side}" data-line="${number}"` : '';
  const button = number !== null
    ? '<button type="button" class="sofa-row-comment" title="Add a comment on this line"'
      + ' aria-label="Add a comment on this line">+</button>'
    : '';

  return `<span class="sofa-gutter sofa-gutter--${kind}">${number ?? ''}</span>`
    + `<span class="sofa-side sofa-side--${kind}"${anchor}>`
    + button
    + `<span class="sofa-code">${code}</span>`
    + '</span>';
}

/**
 * Build the markup for a file laid out side by side.
 *
 * The two columns are highlighted independently, because they are two different
 * revisions of the file: a block comment opened on the left may never have
 * existed on the right, and one shared highlighter state would leak that.
 *
 * @param rows - The file's rows.
 * @param path - File path, used to pick the highlighter language.
 * @param mode - Either whole file or changes only.
 * @param threads - The pull request's review threads.
 * @param drafts - Comments written but not yet submitted.
 * @returns The rows' HTML.
 */
function renderSplitRows(
  rows: Row[],
  path: string,
  mode: ViewMode,
  threads: ReviewThread[],
  drafts: DraftComment[],
): string {
  const lang = languageFor(path);
  const leftState = newHighlightState();
  const rightState = newHighlightState();
  const keep = visibleIndexes(rows, mode);
  const { byRow } = indexThreadsForFile(threads, path);
  const draftRows = draftsByRowFor(drafts, path);
  const parts: string[] = [];
  let skipping = false;

  for (const pair of buildSplitRows(rows)) {
    // Highlighting runs for every line, hidden ones included, because the
    // highlighter carries block state from one line to the next.
    const leftCode = !pair.separator && pair.left ? highlightLine(pair.left.text, lang, leftState) : '';
    const rightCode = !pair.separator && pair.right ? highlightLine(pair.right.text, lang, rightState) : '';

    const visible = !keep
      || (pair.leftIndex !== null && keep.has(pair.leftIndex))
      || (pair.rightIndex !== null && keep.has(pair.rightIndex));
    if (!visible) {
      skipping = true;
      continue;
    }
    if (skipping) {
      parts.push('<div class="sofa-srow sofa-srow--skip"><span>unchanged lines hidden</span></div>');
      skipping = false;
    }

    if (pair.separator) {
      const text = pair.left ? escapeHtml(pair.left.text) : '';
      parts.push(`<div class="sofa-srow sofa-srow--sep"><span>${text}</span></div>`);
      continue;
    }

    // Marked as a change when either column changed, so the next-change jump
    // and the flash treat a side-by-side row the same as a unified one.
    const changed = pair.left?.kind === 'del' || pair.right?.kind === 'add';
    parts.push(
      `<div class="sofa-srow${changed ? ' sofa-srow--change' : ''}">`
        + renderSide(pair.left, 'LEFT', leftCode)
        + renderSide(pair.right, 'RIGHT', rightCode)
        + '</div>',
    );

    // Threads and drafts run the full width under the pair rather than inside
    // one column, so a long comment does not squeeze the code into half a page.
    const here = [
      ...(pair.right?.newNo != null ? byRow.get(rowKey('RIGHT', pair.right.newNo)) ?? [] : []),
      ...(pair.left?.oldNo != null && pair.left.kind === 'del'
        ? byRow.get(rowKey('LEFT', pair.left.oldNo)) ?? []
        : []),
    ];
    for (const thread of here) parts.push(renderThread(thread));

    const pending = [
      ...(pair.right?.newNo != null ? draftRows.get(rowKey('RIGHT', pair.right.newNo)) ?? [] : []),
      ...(pair.left?.oldNo != null && pair.left.kind === 'del'
        ? draftRows.get(rowKey('LEFT', pair.left.oldNo)) ?? []
        : []),
    ];
    for (const draft of pending) parts.push(renderDraft(draft));
  }

  return parts.join('');
}

/**
 * Render one pending comment, waiting to go up with the review.
 *
 * It is marked as pending rather than shown like a posted comment, because the
 * difference matters: nobody else can see it yet, and it will stay that way
 * until the review is submitted.
 *
 * @param draft - The comment being held back.
 * @returns The draft's markup.
 */
function renderDraft(draft: DraftComment): string {
  return '<div class="sofa-thread sofa-thread--draft">'
    + '<div class="sofa-thread-head">'
    + '<span class="sofa-pending">Pending</span>'
    + `<button type="button" class="sofa-draft-discard" data-draft="${escapeHtml(draft.id)}">Discard</button>`
    + '</div>'
    + '<div class="sofa-comment">'
    + `<div class="sofa-comment-body">${renderMarkdown(draft.body)}</div>`
    + '</div>'
    + '</div>';
}

/**
 * Format a timestamp as something a reader can place at a glance.
 *
 * @param iso - An ISO timestamp from the forge.
 * @returns A short local date, or an empty string if it cannot be read.
 */
function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Render one review thread as it appears under its line.
 *
 * Bodies go through the Markdown renderer, which escapes before it formats, so
 * nothing a commenter wrote reaches the page as markup.
 *
 * @param thread - The thread to render.
 * @returns The thread's markup.
 */
function renderThread(thread: ReviewThread): string {
  const comments = thread.comments
    .map((comment) => (
      '<div class="sofa-comment">'
      + '<div class="sofa-comment-head">'
      + `<span class="sofa-comment-author">${escapeHtml(comment.author)}</span>`
      + `<span class="sofa-comment-date">${escapeHtml(shortDate(comment.createdAt))}</span>`
      + (comment.url
        ? `<a class="sofa-comment-link" href="${escapeHtml(comment.url)}" target="_blank" rel="noreferrer">open</a>`
        : '')
      + '</div>'
      + `<div class="sofa-comment-body">${renderMarkdown(comment.body)}</div>`
      + '</div>'
    ))
    .join('');

  const count = thread.comments.length;
  const label = count === 1 ? '1 comment' : `${count} comments`;
  // An outdated thread has lost the line it was written against, so a reply
  // would have nowhere to attach and the button is left off.
  const reply = thread.outdated
    ? ''
    : `<button type="button" class="sofa-thread-reply" data-reply="${thread.id}">Reply</button>`;
  return '<div class="sofa-thread">'
    + `<div class="sofa-thread-head">${label}${thread.outdated ? ' · outdated' : ''}</div>`
    + comments
    + `<div class="sofa-thread-foot">${reply}</div>`
    + '</div>';
}

/**
 * Collect the first row element of each run of changed rows.
 *
 * @param body - The rendered rows container.
 * @returns One element per change block, in document order.
 */
function collectAnchors(body: HTMLElement): HTMLElement[] {
  const anchors: HTMLElement[] = [];
  let previous: Element | null = null;
  const selector = '.sofa-row--add, .sofa-row--del, .sofa-srow--change';
  for (const node of body.querySelectorAll<HTMLElement>(selector)) {
    if (node.previousElementSibling !== previous) anchors.push(node);
    previous = node;
  }
  return anchors;
}

/**
 * Render one file into the given mount element.
 *
 * @param mount - Container that is emptied and filled.
 * @param options - The file, its rows, and the callbacks for its controls.
 * @returns A handle the panel uses for keyboard navigation.
 */
export function renderFile(mount: HTMLElement, options: ViewerOptions): ViewerHandle {
  const { file, model, ctx, headSha } = options;
  const downgraded = options.mode === 'full' && model.rows.length > MAX_FULL_ROWS;
  const mode: ViewMode = downgraded ? 'changes' : options.mode;

  const prevButton = el('button', { className: 'sofa-btn', text: 'Prev change', attrs: { type: 'button', title: 'Previous change (p)' } });
  const nextButton = el('button', { className: 'sofa-btn', text: 'Next change', attrs: { type: 'button', title: 'Next change (n)' } });
  // The button names what clicking it will do, not the state already showing.
  const modeToggle = el('button', {
    className: 'sofa-btn',
    text: mode === 'full' ? 'Changes only' : 'Whole file',
    attrs: { type: 'button', title: 'Toggle whole file or changes only (w)' },
  });
  modeToggle.addEventListener('click', () => options.onModeChange(mode === 'full' ? 'changes' : 'full'));

  // Named for what pressing it does, like the mode toggle beside it.
  const layoutToggle = el('button', {
    className: 'sofa-btn',
    text: options.layout === 'split' ? 'Unified' : 'Side by side',
    attrs: { type: 'button', title: 'Toggle side-by-side or unified (s)' },
  });
  layoutToggle.addEventListener('click', () => {
    options.onLayoutChange(options.layout === 'split' ? 'unified' : 'split');
  });

  const viewedBox = el('input', { attrs: { type: 'checkbox' } });
  viewedBox.checked = options.isViewed;
  viewedBox.addEventListener('change', () => options.onToggleViewed(file.path, viewedBox.checked));

  const header = el('div', {
    className: 'sofa-file-header',
    children: [
      el('div', {
        className: 'sofa-file-title',
        children: [
          el('span', { className: `sofa-status sofa-status--${file.status}`, text: file.status.charAt(0).toUpperCase() }),
          el('span', { className: 'sofa-file-path', text: file.path, attrs: { title: file.path } }),
          el('span', {
            className: 'sofa-file-counts',
            children: [
              el('span', { className: 'sofa-add', text: `+${formatCount(file.additions)}` }),
              el('span', { className: 'sofa-del', text: `-${formatCount(file.deletions)}` }),
            ],
          }),
        ],
      }),
      el('div', {
        className: 'sofa-file-actions',
        children: [
          prevButton,
          nextButton,
          layoutToggle,
          modeToggle,
          el('a', {
            className: 'sofa-btn',
            text: 'Open on GitHub',
            attrs: { href: blobUrl(ctx, headSha, file.path), target: '_blank', rel: 'noreferrer' },
          }),
          el('label', { className: 'sofa-viewed', children: [viewedBox, el('span', { text: 'Viewed' })] }),
        ],
      }),
    ],
  });

  if (file.status === 'renamed' && file.oldPath && file.oldPath !== file.path) {
    header.appendChild(el('div', { className: 'sofa-file-note', text: `Renamed from ${file.oldPath}` }));
  }
  // A binary file's note is already the whole body, so it is not repeated here.
  if (model.note && model.mode !== 'binary') {
    header.appendChild(el('div', { className: 'sofa-file-note sofa-file-note--warn', text: model.note }));
  }
  if (downgraded) {
    header.appendChild(el('div', {
      className: 'sofa-file-note sofa-file-note--warn',
      text: `This file has ${formatCount(model.rows.length)} lines, so only the changed regions are rendered.`,
    }));
  }

  const { detached } = indexThreadsForFile(options.threads, file.path);
  if (detached.length) {
    header.appendChild(el('div', {
      className: 'sofa-file-note',
      text: `${detached.length} comment thread${detached.length === 1 ? '' : 's'} on code that has since changed; `
        + 'open the file on GitHub to read them in place.',
    }));
  }

  const body = el('div', { className: 'sofa-file-body' });
  if (model.mode === 'binary') {
    body.appendChild(el('p', { className: 'sofa-empty', text: 'Binary file not shown.' }));
  } else if (!model.rows.length) {
    body.appendChild(el('p', { className: 'sofa-empty', text: 'No textual changes in this file.' }));
  } else {
    body.classList.toggle('sofa-file-body--split', options.layout === 'split');
    body.innerHTML = options.layout === 'split'
      ? renderSplitRows(model.rows, file.path, mode, options.threads, options.drafts)
      : renderRows(model.rows, file.path, mode, options.threads, options.drafts);
  }

  mount.textContent = '';
  mount.append(header, body);

  const anchors = collectAnchors(body);
  let cursor = -1;

  /**
   * Scroll the next or previous change block into view and flash it.
   *
   * @param direction - `1` for the next change, `-1` for the previous one.
   */
  function jumpToChange(direction: number): void {
    if (!anchors.length) return;
    cursor = cursor === -1 && direction < 0 ? 0 : cursor + direction;
    if (cursor < 0) cursor = anchors.length - 1;
    if (cursor >= anchors.length) cursor = 0;
    const target = anchors[cursor];
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.add('is-flash');
    setTimeout(() => target.classList.remove('is-flash'), 700);
  }

  prevButton.addEventListener('click', () => jumpToChange(-1));
  nextButton.addEventListener('click', () => jumpToChange(1));

  // One box at a time, the way GitHub behaves: opening a second closes the
  // first, so a half-written comment cannot be left somewhere off screen.
  let openBox: HTMLElement | null = null;

  /**
   * Take down whatever comment box is open.
   */
  function closeBox(): void {
    openBox?.remove();
    openBox = null;
  }

  /**
   * Put a comment box into the rows, just after the element it belongs to.
   *
   * @param after - The row or thread the box is attached to.
   * @param box - The box's element.
   */
  function openAfter(after: Element, box: HTMLElement): void {
    closeBox();
    const holder = el('div', { className: 'sofa-inline-compose', children: [box] });
    after.insertAdjacentElement('afterend', holder);
    openBox = holder;
  }

  body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const discard = target.closest<HTMLElement>('.sofa-draft-discard');
    if (discard) {
      const id = discard.dataset['draft'];
      if (id) options.onDiscardDraft(id);
      return;
    }

    const replyButton = target.closest<HTMLElement>('.sofa-thread-reply');
    if (replyButton) {
      const inReplyTo = Number(replyButton.dataset['reply']);
      const thread = replyButton.closest('.sofa-thread');
      if (!thread || !Number.isFinite(inReplyTo)) return;
      const compose = createCompose({
        placeholder: 'Reply',
        onCancel: closeBox,
        actions: [{
          label: 'Reply',
          primary: true,
          run: async (value) => {
            const error = await options.onReply(inReplyTo, value);
            if (!error) closeBox();
            return error;
          },
        }],
      });
      openAfter(thread, compose.element);
      compose.focus();
      return;
    }

    const addButton = target.closest<HTMLElement>('.sofa-row-comment');
    if (!addButton) return;
    // The anchor is on the row in the unified view and on the column in the
    // side-by-side one, so it is found by attribute rather than by class.
    const anchor = addButton.closest<HTMLElement>('[data-side][data-line]');
    const row = addButton.closest<HTMLElement>('.sofa-row, .sofa-srow');
    const side = anchor?.dataset['side'] as DiffSide | undefined;
    const line = Number(anchor?.dataset['line']);
    if (!row || !side || !Number.isFinite(line)) return;

    const commentTarget: CommentTarget = { path: file.path, line, side };
    const compose = createCompose({
      onCancel: closeBox,
      actions: [
        {
          label: 'Add single comment',
          run: async (value) => {
            const error = await options.onAddComment(commentTarget, value);
            if (!error) closeBox();
            return error;
          },
        },
        {
          // Once a review is under way the button stops offering to start one,
          // which is exactly how GitHub relabels it.
          label: options.hasPendingReview ? 'Add review comment' : 'Start a review',
          primary: true,
          run: async (value) => {
            const error = await options.onDraftComment(commentTarget, value);
            if (!error) closeBox();
            return error;
          },
        },
      ],
    });
    openAfter(row, compose.element);
    compose.focus();
  });

  return { jumpToChange, scroller: body, renderedMode: mode };
}
