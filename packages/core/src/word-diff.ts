/**
 * Word-level highlighting for a changed line.
 *
 * A line diff says a line changed; this says which words in it did, so a
 * reviewer comparing two long lines side by side can see the one token that
 * differs instead of reading both in full.
 */

/**
 * One run of a line, marked as shared with the other side or not.
 */
export interface WordRun {
  /** The text of the run, whitespace included. */
  text: string;
  /** True when this run does not appear on the other side. */
  changed: boolean;
}

/**
 * Split a line into words and the whitespace between them.
 *
 * @param line - The line to split.
 * @returns Alternating word and whitespace tokens, in order.
 */
function tokenize(line: string): string[] {
  return line.match(/\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]/g) ?? [];
}

/**
 * Lengths of the longest common subsequence between two token lists.
 *
 * @param a - Tokens of the old line.
 * @param b - Tokens of the new line.
 * @returns The dynamic-programming table, one row per token of `a` plus one.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j]
        ? table[i + 1]![j + 1]! + 1
        : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

/**
 * Mark which words of each line are not in the other.
 *
 * @param oldLine - The removed line.
 * @param newLine - The line that replaced it.
 * @returns The runs for each side.
 */
export function wordDiff(oldLine: string, newLine: string): { left: WordRun[]; right: WordRun[] } {
  const a = tokenize(oldLine);
  const b = tokenize(newLine);
  const table = lcsTable(a, b);
  const left: WordRun[] = [];
  const right: WordRun[] = [];

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left.push({ text: a[i]!, changed: false });
      right.push({ text: b[j]!, changed: false });
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      left.push({ text: a[i++]!, changed: true });
    } else {
      right.push({ text: b[j++]!, changed: true });
    }
  }
  while (i < a.length) left.push({ text: a[i++]!, changed: true });
  while (j < b.length) right.push({ text: b[j++]!, changed: true });
  return { left, right };
}
