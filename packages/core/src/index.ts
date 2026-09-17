/**
 * The forge-agnostic half of Sofa: parse a unified diff, splice it into the
 * file it describes, and colour the result.
 *
 * Nothing here touches the DOM, the network or the extension APIs, so it can be
 * tested with plain `node --test` and reused outside the extension.
 */
export type {
  DiffFile,
  FileModel,
  FileStatus,
  Hunk,
  HunkLine,
  LineKind,
  PrContext,
  RenderMode,
  Row,
  ViewMode,
} from './types.ts';

export { parseUnifiedDiff, normalizePath } from './diff.ts';
export { buildFileModel, mergeFullFile, rowsFromHunks, findChangeAnchors } from './model.ts';
export { highlightLine, languageFor, newHighlightState } from './highlight.ts';
export type { HighlightState, Language } from './highlight.ts';
export { escapeHtml, formatCount, splitLines, debounce } from './text.ts';
export { renderMarkdown } from './markdown.ts';

export {
  parseReviewComments,
  buildThreads,
  indexThreadsForFile,
  rowKey,
} from './review.ts';
export type { DiffSide, ReviewComment, ReviewThread } from './review.ts';
