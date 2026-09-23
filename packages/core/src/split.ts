/**
 * Pair a file's rows into two columns, for the side-by-side view.
 *
 * The model produces one flat sequence of rows, which is what a unified diff
 * is. A side-by-side view needs the same information folded into pairs: the old
 * revision on the left, the new on the right, lines that did not change on both,
 * and a blank where one side has nothing to show.
 *
 * The pairing rule is the one every side-by-side viewer uses. Within a run of
 * changed lines, the nth removal is shown opposite the nth addition, because a
 * change to a line almost always arrives as a removal and an addition in the
 * same position. A longer run on one side leaves fillers opposite the remainder.
 */
import type { Row } from './types.ts';

/**
 * One line of the side-by-side view.
 *
 * Both sides can be null: the left when a line was added, the right when one
 * was removed. A separator spans the full width and has no right side at all.
 */
export interface SplitRow {
  /** The old revision's line, or null when this row only adds. */
  left: Row | null;
  /** Where `left` sat in the source rows, for anchoring comments to it. */
  leftIndex: number | null;
  /** The new revision's line, or null when this row only removes. */
  right: Row | null;
  /** Where `right` sat in the source rows. */
  rightIndex: number | null;
  /** True for a hunk header, which is drawn across both columns. */
  separator: boolean;
}

/**
 * Fold a flat row sequence into left and right columns.
 *
 * @param rows - The file's rows, as `buildFileModel` produced them.
 * @returns One entry per visual line of the side-by-side view.
 */
export function buildSplitRows(rows: Row[]): SplitRow[] {
  const out: SplitRow[] = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (!row) {
      i += 1;
      continue;
    }

    if (row.kind === 'separator') {
      out.push({ left: row, leftIndex: i, right: null, rightIndex: null, separator: true });
      i += 1;
      continue;
    }

    // An unchanged line is the same text on both sides, so it is shown twice
    // and keeps the two columns in step.
    if (row.kind === 'context') {
      out.push({ left: row, leftIndex: i, right: row, rightIndex: i, separator: false });
      i += 1;
      continue;
    }

    // A run of changes: everything removed, then everything added, zipped so a
    // rewritten line sits opposite its replacement.
    const dels: { row: Row; index: number }[] = [];
    const adds: { row: Row; index: number }[] = [];
    while (i < rows.length) {
      const next = rows[i];
      if (!next || (next.kind !== 'add' && next.kind !== 'del')) break;
      if (next.kind === 'del') dels.push({ row: next, index: i });
      else adds.push({ row: next, index: i });
      i += 1;
    }

    const height = Math.max(dels.length, adds.length);
    for (let k = 0; k < height; k++) {
      const left = dels[k];
      const right = adds[k];
      out.push({
        left: left?.row ?? null,
        leftIndex: left?.index ?? null,
        right: right?.row ?? null,
        rightIndex: right?.index ?? null,
        separator: false,
      });
    }
  }

  return out;
}
