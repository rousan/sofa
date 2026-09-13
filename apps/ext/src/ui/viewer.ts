/**
 * The right-hand pane: one file at a time, shown as the whole file with the
 * diff spliced into it.
 *
 * Rows are built as a single HTML string rather than through the DOM API,
 * because a real source file routinely runs to thousands of lines and the
 * difference is between an instant file switch and a visible stall.
 */
import {
  escapeHtml,
  formatCount,
  highlightLine,
  indexThreadsForFile,
  languageFor,
  newHighlightState,
  rowKey,
} from '@sofa/core';
import { el } from '../util.ts';
import { blobUrl } from '../github.ts';
import type { DiffFile, FileModel, PrContext, ReviewThread, Row, ViewMode } from '@sofa/core';

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
  /** Whether this file is currently marked viewed. */
  isViewed: boolean;
  /** Called when the viewed checkbox changes. */
  onToggleViewed: (path: string, isViewed: boolean) => void;
  /** Called when the whole-file toggle is used. */
  onModeChange: (mode: ViewMode) => void;
  /** Review threads for the whole pull request, filtered here to this file. */
  threads: ReviewThread[];
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
function renderRows(rows: Row[], path: string, mode: ViewMode, threads: ReviewThread[]): string {
  const lang = languageFor(path);
  const state = newHighlightState();
  const keep = visibleIndexes(rows, mode);
  const { byRow } = indexThreadsForFile(threads, path);
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
    parts.push(
      `<div class="sofa-row sofa-row--${row.kind}" data-index="${index}">`
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
  });

  return parts.join('');
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
 * The bodies are Markdown as written. They are escaped and shown as-is rather
 * than rendered: a half-implemented Markdown renderer would misrepresent what
 * someone actually said, and getting that wrong in a code review is worse than
 * showing the source.
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
      + `<div class="sofa-comment-body">${escapeHtml(comment.body)}</div>`
      + '</div>'
    ))
    .join('');

  const count = thread.comments.length;
  const label = count === 1 ? '1 comment' : `${count} comments`;
  return '<div class="sofa-thread">'
    + `<div class="sofa-thread-head">${label}${thread.outdated ? ' · outdated' : ''}</div>`
    + comments
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
  for (const node of body.querySelectorAll<HTMLElement>('.sofa-row--add, .sofa-row--del')) {
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
    body.innerHTML = renderRows(model.rows, file.path, mode, options.threads);
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

  return { jumpToChange, scroller: body, renderedMode: mode };
}
