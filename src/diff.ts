/**
 * Parser for the git unified diff that GitHub serves at `<pull-request>.diff`.
 *
 * The parser is deliberately tolerant: an unrecognised header line is skipped
 * rather than treated as an error, because forges add metadata lines over time
 * and one unknown line should never cost a whole file's diff.
 */
import type { DiffFile, Hunk, LineKind } from './types.ts';

/**
 * Strip the `a/` or `b/` prefix and any trailing tab metadata from a path line.
 *
 * @param value - The raw text following `--- `, `+++ ` or a rename header.
 * @returns The repository-relative path, or null for `/dev/null`.
 */
export function normalizePath(value: string): string | null {
  let text = (value.split('\t')[0] ?? '').trim();
  if (text === '/dev/null') return null;
  if (text.startsWith('"') && text.endsWith('"') && text.length > 1) {
    // Git quotes paths containing unusual bytes using C escapes, of which JSON
    // string escapes are a close enough superset to decode.
    try {
      text = JSON.parse(text) as string;
    } catch {
      text = text.slice(1, -1);
    }
  }
  if (text.startsWith('a/') || text.startsWith('b/')) text = text.slice(2);
  return text;
}

/**
 * Create an empty file record for a `diff --git` header line.
 *
 * @param headerLine - The full `diff --git a/x b/x` line.
 * @returns A file record with no hunks and zeroed counters.
 */
function createFile(headerLine: string): DiffFile {
  const match = /^diff --git (.+) (.+)$/.exec(headerLine);
  // The two halves are ambiguous when a path contains a space, so whatever is
  // guessed here is overridden by the later `---` and `+++` lines.
  const oldPath = match ? normalizePath(match[1] ?? '') : null;
  const path = match ? normalizePath(match[2] ?? '') : null;
  return {
    path: path ?? oldPath ?? '(unknown)',
    oldPath,
    status: 'modified',
    binary: false,
    additions: 0,
    deletions: 0,
    hunks: [],
  };
}

/**
 * Parse a whole unified diff into one record per changed file.
 *
 * @param text - The complete diff document.
 * @returns File records, in the order the diff listed them.
 */
export function parseUnifiedDiff(text: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  let file: DiffFile | null = null;
  let hunk: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      file = createFile(line);
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;

    if (line.startsWith('new file mode')) {
      file.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      file.status = 'deleted';
      continue;
    }
    if (line.startsWith('rename from ')) {
      file.oldPath = normalizePath(line.slice('rename from '.length));
      file.status = 'renamed';
      continue;
    }
    if (line.startsWith('rename to ')) {
      file.path = normalizePath(line.slice('rename to '.length)) ?? file.path;
      file.status = 'renamed';
      continue;
    }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      file.binary = true;
      continue;
    }
    if (line.startsWith('--- ')) {
      const parsed = normalizePath(line.slice(4));
      if (parsed) file.oldPath = parsed;
      continue;
    }
    if (line.startsWith('+++ ')) {
      const parsed = normalizePath(line.slice(4));
      if (parsed) file.path = parsed;
      continue;
    }

    const header = /^@@+ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@+(.*)$/.exec(line);
    if (header) {
      hunk = {
        oldStart: Number(header[1]),
        oldCount: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newCount: header[4] === undefined ? 1 : Number(header[4]),
        section: (header[5] ?? '').trim(),
        lines: [],
      };
      file.hunks.push(hunk);
      continue;
    }

    if (!hunk) continue;
    // The "\ No newline at end of file" marker carries no content.
    if (line.startsWith('\\')) continue;

    const marker = line.charAt(0);
    let kind: LineKind | null = null;
    if (marker === '+') kind = 'add';
    else if (marker === '-') kind = 'del';
    else if (marker === ' ' || line === '') kind = 'context';
    if (!kind) continue;

    hunk.lines.push({ kind, text: line === '' ? '' : line.slice(1) });
    if (kind === 'add') file.additions++;
    else if (kind === 'del') file.deletions++;
  }

  // A hunk header can claim a length its body does not deliver when a diff is
  // truncated, so the body is treated as the source of truth for the counts the
  // merge step relies on.
  for (const entry of files) {
    for (const item of entry.hunks) {
      item.oldCount = item.lines.filter((l) => l.kind !== 'add').length;
      item.newCount = item.lines.filter((l) => l.kind !== 'del').length;
    }
  }

  return files;
}
