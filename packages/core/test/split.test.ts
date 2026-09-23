/**
 * Tests for the side-by-side pairing.
 *
 * The property that matters is alignment: the two columns must stay in step, so
 * a reader comparing line 40 on the left with line 40 on the right is looking at
 * the same place in the file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSplitRows } from '../src/split.ts';
import type { Row } from '../src/types.ts';

/**
 * Build a row without writing out every field at each call site.
 *
 * @param kind - The row's kind.
 * @param oldNo - Old-revision line number, or null.
 * @param newNo - New-revision line number, or null.
 * @param text - The line's text.
 * @returns The row.
 */
function row(kind: Row['kind'], oldNo: number | null, newNo: number | null, text: string): Row {
  return { kind, oldNo, newNo, text };
}

test('shows an unchanged line on both sides', () => {
  const [pair] = buildSplitRows([row('context', 1, 1, 'same')]);
  assert.equal(pair?.left?.text, 'same');
  assert.equal(pair?.right?.text, 'same');
  assert.equal(pair?.leftIndex, 0);
  assert.equal(pair?.rightIndex, 0);
});

test('puts a removal opposite the addition that replaced it', () => {
  const pairs = buildSplitRows([
    row('del', 4, null, 'was'),
    row('add', null, 4, 'now'),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.left?.text, 'was');
  assert.equal(pairs[0]?.right?.text, 'now');
});

test('zips a run of removals against a run of additions', () => {
  const pairs = buildSplitRows([
    row('del', 4, null, 'a'),
    row('del', 5, null, 'b'),
    row('add', null, 4, 'x'),
    row('add', null, 5, 'y'),
  ]);
  assert.deepEqual(pairs.map((p) => [p.left?.text, p.right?.text]), [['a', 'x'], ['b', 'y']]);
});

test('leaves a filler opposite the longer side', () => {
  const pairs = buildSplitRows([
    row('del', 4, null, 'a'),
    row('add', null, 4, 'x'),
    row('add', null, 5, 'y'),
  ]);
  assert.deepEqual(pairs.map((p) => [p.left?.text ?? null, p.right?.text ?? null]), [
    ['a', 'x'],
    [null, 'y'],
  ]);
});

test('gives a pure addition an empty left side', () => {
  const pairs = buildSplitRows([row('add', null, 7, 'new line')]);
  assert.equal(pairs[0]?.left, null);
  assert.equal(pairs[0]?.leftIndex, null);
  assert.equal(pairs[0]?.right?.text, 'new line');
});

test('gives a pure deletion an empty right side', () => {
  const pairs = buildSplitRows([row('del', 7, null, 'gone')]);
  assert.equal(pairs[0]?.left?.text, 'gone');
  assert.equal(pairs[0]?.right, null);
});

test('carries a separator across both columns', () => {
  const [pair] = buildSplitRows([row('separator', null, null, '@@ -1,2 +1,2 @@')]);
  assert.equal(pair?.separator, true);
  assert.equal(pair?.right, null);
});

test('keeps the columns in step across a whole file', () => {
  const pairs = buildSplitRows([
    row('context', 1, 1, 'one'),
    row('del', 2, null, 'old two'),
    row('add', null, 2, 'new two'),
    row('add', null, 3, 'added three'),
    row('context', 3, 4, 'four'),
  ]);
  // Four visual lines: the shared first, the replaced second, the extra
  // addition against a filler, and the shared last.
  assert.equal(pairs.length, 4);
  assert.equal(pairs[2]?.left, null);
  assert.equal(pairs[3]?.left?.text, 'four');
  assert.equal(pairs[3]?.right?.text, 'four');
});

test('returns nothing for a file with no rows', () => {
  assert.deepEqual(buildSplitRows([]), []);
});
