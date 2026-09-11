/**
 * Builds the row model the viewer renders.
 *
 * This is the core idea of Sofa. GitHub shows only the hunks a diff contains, so
 * a change inside a long function arrives with three lines of context and no
 * function around it. Given the full head-revision text of a file, the functions
 * here splice the hunks back into the complete file: one row per line of the
 * file, with the removed lines interleaved where they used to be.
 */
import { splitLines } from './util.ts';
import type { DiffFile, FileModel, Row } from './types.ts';

/**
 * Flatten a file's hunks into rows with no surrounding file context.
 *
 * This is the fallback rendering, and the complete rendering for added and
 * deleted files, whose diffs already contain every line.
 *
 * @param file - The file whose hunks are flattened.
 * @returns Rows, with a separator row wherever the diff skipped lines.
 */
export function rowsFromHunks(file: DiffFile): Row[] {
  const rows: Row[] = [];
  file.hunks.forEach((hunk, index) => {
    if (index > 0 || hunk.newStart > 1 || hunk.oldStart > 1) {
      rows.push({ kind: 'separator', text: hunk.section, oldNo: null, newNo: null });
    }
    let oldNo = hunk.oldStart;
    let newNo = hunk.newStart;
    for (const line of hunk.lines) {
      if (line.kind === 'del') {
        rows.push({ kind: 'del', oldNo, newNo: null, text: line.text });
        oldNo++;
      } else if (line.kind === 'add') {
        rows.push({ kind: 'add', oldNo: null, newNo, text: line.text });
        newNo++;
      } else {
        rows.push({ kind: 'context', oldNo, newNo, text: line.text });
        oldNo++;
        newNo++;
      }
    }
  });
  return rows;
}

/**
 * Splice a file's hunks into its full head-revision text.
 *
 * Walks the head file from line 1, emitting untouched lines as context and
 * handing over to the diff whenever a hunk starts. Old-revision line numbers
 * outside hunks come from the running length delta of the hunks seen so far, so
 * both gutters stay correct for the whole file.
 *
 * @param file - The file being rendered.
 * @param headLines - Every line of the file at the pull request's head.
 * @returns The rows, plus whether the hunks' context actually matched the head
 *   text (a mismatch means the head text came from the wrong commit).
 */
export function mergeFullFile(file: DiffFile, headLines: string[]): { rows: Row[]; reliable: boolean } {
  const rows: Row[] = [];
  const hunks = [...file.hunks].sort((a, b) => a.newStart - b.newStart);
  // `cursor` is the next head line not yet emitted; `delta` is newNo - oldNo for
  // lines outside every hunk processed so far.
  let cursor = 1;
  let delta = 0;
  let checked = 0;
  let mismatched = 0;

  for (const hunk of hunks) {
    while (cursor < hunk.newStart && cursor <= headLines.length) {
      rows.push({ kind: 'context', oldNo: cursor - delta, newNo: cursor, text: headLines[cursor - 1] ?? '' });
      cursor++;
    }

    let oldNo = hunk.oldStart;
    let newNo = hunk.newStart;
    for (const line of hunk.lines) {
      if (line.kind === 'del') {
        rows.push({ kind: 'del', oldNo, newNo: null, text: line.text });
        oldNo++;
        continue;
      }
      const headText = headLines[newNo - 1];
      if (headText !== undefined) {
        checked++;
        if (headText !== line.text) mismatched++;
      }
      rows.push({
        kind: line.kind,
        oldNo: line.kind === 'context' ? oldNo : null,
        newNo,
        // Prefer the head text so the rendered file reads consistently even if
        // the diff was produced with different whitespace handling.
        text: headText !== undefined ? headText : line.text,
      });
      if (line.kind === 'context') oldNo++;
      newNo++;
    }

    cursor = Math.max(cursor, newNo);
    delta += hunk.newCount - hunk.oldCount;
  }

  while (cursor <= headLines.length) {
    rows.push({ kind: 'context', oldNo: cursor - delta, newNo: cursor, text: headLines[cursor - 1] ?? '' });
    cursor++;
  }

  return { rows, reliable: checked === 0 || mismatched / checked <= 0.02 };
}

/**
 * Decide how to render one file and produce its rows.
 *
 * @param file - The file to render.
 * @param headText - Full head-revision text, or null when it could not be
 *   fetched (a deleted file, a binary, or a failed request).
 * @returns The rows plus the mode, completeness and any explanatory note.
 */
export function buildFileModel(file: DiffFile, headText: string | null): FileModel {
  if (file.binary) {
    return { mode: 'binary', rows: [], complete: false, note: 'Binary file not shown.', mismatch: false };
  }
  // A deleted file's diff contains every removed line and an added file's diff
  // contains every added line, so for those the hunks are the whole file.
  const hunksAreWholeFile = file.status === 'deleted' || file.status === 'added';

  if (headText != null && file.status !== 'deleted') {
    const merged = mergeFullFile(file, splitLines(headText));
    if (merged.reliable) {
      return { mode: 'full', rows: merged.rows, complete: true, note: '', mismatch: false };
    }
    return {
      mode: 'hunks',
      rows: rowsFromHunks(file),
      complete: hunksAreWholeFile,
      note: 'The fetched file did not match this diff, so only the changed hunks are shown.',
      mismatch: true,
    };
  }

  return {
    mode: 'hunks',
    rows: rowsFromHunks(file),
    complete: hunksAreWholeFile,
    note: hunksAreWholeFile ? '' : 'Could not load the full file, so only the changed hunks are shown.',
    mismatch: false,
  };
}

/**
 * Find the row indexes that begin a run of added or removed lines.
 *
 * The viewer uses these as the jump targets for next and previous change.
 *
 * @param rows - Rows produced by `buildFileModel`.
 * @returns Indexes into `rows`, in document order.
 */
export function findChangeAnchors(rows: Row[]): number[] {
  const anchors: number[] = [];
  let inChange = false;
  rows.forEach((row, index) => {
    const isChange = row.kind === 'add' || row.kind === 'del';
    if (isChange && !inChange) anchors.push(index);
    inChange = isChange;
  });
  return anchors;
}
