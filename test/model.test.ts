/**
 * Tests for the diff parser and the full-file merge, which together are the
 * only logic in Sofa that can silently produce a wrong-looking file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUnifiedDiff } from '../src/diff.ts';
import { buildFileModel, findChangeAnchors } from '../src/model.ts';
import type { Row } from '../src/types.ts';

/**
 * Wrap hunk lines in the file headers a real diff would carry.
 *
 * @param body - Hunk header and body lines for one modified file.
 * @returns A complete unified diff for `src/a.ts`.
 */
function diffFor(body: string[]): string {
  return [
    'diff --git a/src/a.ts b/src/a.ts',
    'index 1111111..2222222 100644',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    ...body,
  ].join('\n');
}

/**
 * Render rows into short strings so an assertion reads like the expected view.
 *
 * @param rows - Rows from `buildFileModel`.
 * @returns One `kind:old:new:text` string per row.
 */
function summarise(rows: Row[]): string[] {
  return rows.map((row) => `${row.kind}:${row.oldNo ?? '-'}:${row.newNo ?? '-'}:${row.text}`);
}

test('splices a hunk back into the whole head file', () => {
  const head = 'line1\nline2\nNEW\nline4\nline5\n';
  const file = parseUnifiedDiff(diffFor([
    '@@ -2,3 +2,3 @@ section',
    ' line2',
    '-OLD',
    '+NEW',
    ' line4',
  ]))[0]!;

  const model = buildFileModel(file, head);

  assert.equal(model.mode, 'full');
  assert.equal(model.complete, true);
  assert.deepEqual(summarise(model.rows), [
    'context:1:1:line1',
    'context:2:2:line2',
    'del:3:-:OLD',
    'add:-:3:NEW',
    'context:4:4:line4',
    'context:5:5:line5',
  ]);
});

test('keeps both gutters correct after the hunk changes the file length', () => {
  const head = 'a\nb\nX\nY\nc\nd';
  const file = parseUnifiedDiff(diffFor([
    '@@ -2,2 +2,3 @@',
    ' b',
    '+X',
    '+Y',
    '-Z',
    ' c',
  ]))[0]!;

  const model = buildFileModel(file, head);
  const last = model.rows[model.rows.length - 1]!;

  assert.equal(last.text, 'd');
  assert.equal(last.newNo, 6);
  // Two lines were added and one removed above it, so the old file had it at 5.
  assert.equal(last.oldNo, 5);
});

test('falls back to hunks when the head text does not match the diff', () => {
  const file = parseUnifiedDiff(diffFor([
    '@@ -1,2 +1,2 @@',
    ' totally',
    '+different',
    '-context',
  ]))[0]!;

  const model = buildFileModel(file, 'nothing\nlike\nthe\ndiff\n');

  assert.equal(model.mode, 'hunks');
  assert.match(model.note, /did not match/);
});

test('treats an added file as complete without any head fetch', () => {
  const file = parseUnifiedDiff([
    'diff --git a/new.ts b/new.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/new.ts',
    '@@ -0,0 +1,2 @@',
    '+one',
    '+two',
  ].join('\n'))[0]!;

  const model = buildFileModel(file, null);

  assert.equal(file.status, 'added');
  assert.equal(model.complete, true);
  assert.equal(model.note, '');
  assert.equal(model.rows.filter((row) => row.kind === 'add').length, 2);
});

test('reports a binary file instead of trying to render it', () => {
  const file = parseUnifiedDiff([
    'diff --git a/docs/shot.png b/docs/shot.png',
    'new file mode 100644',
    'Binary files /dev/null and b/docs/shot.png differ',
  ].join('\n'))[0]!;

  const model = buildFileModel(file, null);

  assert.equal(model.mode, 'binary');
  assert.equal(model.rows.length, 0);
});

test('parses renames and counts additions and deletions per file', () => {
  const files = parseUnifiedDiff([
    'diff --git a/old/name.ts b/new/name.ts',
    'similarity index 90%',
    'rename from old/name.ts',
    'rename to new/name.ts',
    '--- a/old/name.ts',
    '+++ b/new/name.ts',
    '@@ -1,2 +1,2 @@',
    '-before',
    '+after',
    ' tail',
  ].join('\n'));

  assert.equal(files.length, 1);
  assert.equal(files[0]!.status, 'renamed');
  assert.equal(files[0]!.path, 'new/name.ts');
  assert.equal(files[0]!.oldPath, 'old/name.ts');
  assert.equal(files[0]!.additions, 1);
  assert.equal(files[0]!.deletions, 1);
});

test('anchors point at the first row of each change run', () => {
  const rows = [
    { kind: 'context' },
    { kind: 'add' },
    { kind: 'add' },
    { kind: 'context' },
    { kind: 'del' },
  ] as Row[];

  assert.deepEqual(findChangeAnchors(rows), [1, 4]);
});

test('flags a head-text mismatch so the caller can retry with a better sha', () => {
  const file = parseUnifiedDiff(diffFor([
    '@@ -1,2 +1,2 @@',
    ' expected context',
    '+added line',
    '-removed line',
  ]))[0]!;

  const wrongRevision = buildFileModel(file, 'a file\nfrom some\nother commit\n');
  assert.equal(wrongRevision.mismatch, true);

  const rightRevision = buildFileModel(file, 'expected context\nadded line\n');
  assert.equal(rightRevision.mismatch, false);
  assert.equal(rightRevision.mode, 'full');
});

test('a file that simply could not be fetched is not reported as a mismatch', () => {
  const file = parseUnifiedDiff(diffFor([
    '@@ -1,1 +1,2 @@',
    ' context',
    '+added',
  ]))[0]!;

  const model = buildFileModel(file, null);

  assert.equal(model.mismatch, false);
  assert.match(model.note, /Could not load/);
});

test('does not absorb the trailing newline as a context line', () => {
  // A real diff document ends with a newline, so splitting it yields one final
  // empty string. Absorbing that invents a line the file does not have, which
  // then fails the match check and drops the file to a hunks-only rendering.
  const diff = diffFor([
    '@@ -1,4 +1,4 @@',
    ' {',
    '-  "version": "1.0.0",',
    '+  "version": "1.0.1",',
    '   "type": "module",',
    '   "bin": {',
  ]) + '\n';

  const file = parseUnifiedDiff(diff)[0]!;
  const lastLine = file.hunks[0]!.lines.at(-1)!;

  assert.equal(lastLine.text, '  "bin": {');
  assert.equal(file.hunks[0]!.newCount, 4);

  const head = '{\n  "version": "1.0.1",\n  "type": "module",\n  "bin": {\n    "x": "./x.js"\n  }\n}\n';
  const model = buildFileModel(file, head);

  assert.equal(model.mismatch, false);
  assert.equal(model.mode, 'full');
  // The whole file is rendered, including the lines past the hunk.
  assert.equal(model.rows.at(-1)!.text, '}');
});

test('stops a hunk at its declared length so later junk is ignored', () => {
  const file = parseUnifiedDiff(diffFor([
    '@@ -1,2 +1,2 @@',
    ' one',
    '-two',
    '+TWO',
    '',
    'trailing junk that is not part of the hunk',
  ]))[0]!;

  assert.deepEqual(file.hunks[0]!.lines.map((l) => l.text), ['one', 'two', 'TWO']);
});
