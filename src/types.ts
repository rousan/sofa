/**
 * Shared types for the Sofa extension.
 *
 * The data flow is linear: `DiffFile` records come out of the diff parser, the
 * model layer turns one of them plus the file's head text into `Row` values, and
 * the viewer renders those rows.
 */

/**
 * How a file changed in the pull request, as reported by the diff headers.
 */
export type FileStatus = 'added' | 'deleted' | 'renamed' | 'modified';

/**
 * The three line kinds a unified diff hunk body can contain.
 */
export type LineKind = 'add' | 'del' | 'context';

/**
 * One line inside a hunk body.
 */
export interface HunkLine {
  /** Whether the line was added, removed, or is unchanged context. */
  kind: LineKind;
  /** The line's text, with the leading diff marker already stripped. */
  text: string;
}

/**
 * One `@@` hunk of a file's diff.
 */
export interface Hunk {
  /** First line number this hunk covers in the old revision. */
  oldStart: number;
  /** How many old-revision lines the hunk covers. */
  oldCount: number;
  /** First line number this hunk covers in the new revision. */
  newStart: number;
  /** How many new-revision lines the hunk covers. */
  newCount: number;
  /** The trailing text of the `@@` header, usually the enclosing declaration. */
  section: string;
  /** The hunk body, in order. */
  lines: HunkLine[];
}

/**
 * Everything the diff tells us about one changed file.
 */
export interface DiffFile {
  /** Path at the pull request's head revision. */
  path: string;
  /** Path at the base revision, which differs only for renames. */
  oldPath: string | null;
  /** How the file changed. */
  status: FileStatus;
  /** True when the diff carried no text, so nothing can be rendered. */
  binary: boolean;
  /** Number of added lines. */
  additions: number;
  /** Number of removed lines. */
  deletions: number;
  /** The file's hunks, in the order the diff listed them. */
  hunks: Hunk[];
}

/**
 * A row of the viewer. `separator` rows stand in for skipped regions and carry
 * the hunk's section text instead of file content.
 */
export interface Row {
  /** The row's kind; `separator` is a viewer-only pseudo kind. */
  kind: LineKind | 'separator';
  /** Line number in the old revision, or null when the row has none. */
  oldNo: number | null;
  /** Line number in the new revision, or null when the row has none. */
  newNo: number | null;
  /** The row's text. */
  text: string;
}

/**
 * How completely a file could be rendered.
 *
 * `full` means the rows cover the whole head file, `hunks` means only the diff's
 * own hunks are present, and `binary` means there is nothing to show.
 */
export type RenderMode = 'full' | 'hunks' | 'binary';

/**
 * The rows for one file plus what the viewer needs to say about them.
 */
export interface FileModel {
  /** Which rendering the model layer settled on. */
  mode: RenderMode;
  /** The rows to render. */
  rows: Row[];
  /** True when the rows account for every line of the file. */
  complete: boolean;
  /** A message explaining an incomplete rendering, or an empty string. */
  note: string;
}

/**
 * Whether the viewer shows the whole file or only the changed regions.
 */
export type ViewMode = 'full' | 'changes';

/**
 * The coordinates of the pull request being reviewed.
 */
export interface PrContext {
  /** Forge origin, so the same code works on github.com and Enterprise. */
  origin: string;
  /** Repository owner or organisation. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Pull request number. */
  number: number;
  /** The pull request tab the URL pointed at, for reference. */
  tab: string;
}
