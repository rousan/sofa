/**
 * Tests for turning the forge's flat comment list into anchored threads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThreads, indexThreadsForFile, parseReviewComments, rowKey } from '../src/review.ts';

/**
 * Build one comment in the shape the API returns.
 *
 * @param over - Fields to override on the default comment.
 * @returns A raw comment object.
 */
function raw(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    path: 'src/a.ts',
    line: 10,
    original_line: 10,
    side: 'RIGHT',
    body: 'a comment',
    user: { login: 'reviewer' },
    created_at: '2026-09-01T10:00:00Z',
    in_reply_to_id: null,
    html_url: 'https://example.test/1',
    ...over,
  };
}

test('reads the fields the viewer needs', () => {
  const [comment] = parseReviewComments([raw()]);

  assert.equal(comment?.id, 1);
  assert.equal(comment?.path, 'src/a.ts');
  assert.equal(comment?.line, 10);
  assert.equal(comment?.side, 'RIGHT');
  assert.equal(comment?.author, 'reviewer');
  assert.equal(comment?.outdated, false);
});

test('falls back to the original line, and marks the thread outdated', () => {
  const [comment] = parseReviewComments([raw({ line: null, original_line: 42 })]);

  assert.equal(comment?.line, 42);
  assert.equal(comment?.outdated, true);
});

test('drops entries that cannot be placed rather than guessing', () => {
  const comments = parseReviewComments([
    raw(),
    raw({ id: undefined }),
    raw({ path: undefined }),
    'not a comment',
    null,
  ]);

  assert.equal(comments.length, 1);
});

test('threads replies under the comment that started them', () => {
  const comments = parseReviewComments([
    raw({ id: 1, created_at: '2026-09-01T10:00:00Z' }),
    raw({ id: 2, in_reply_to_id: 1, body: 'reply', created_at: '2026-09-01T11:00:00Z' }),
    // A reply to a reply still belongs to the root thread.
    raw({ id: 3, in_reply_to_id: 2, body: 'reply to reply', created_at: '2026-09-01T12:00:00Z' }),
  ]);

  const threads = buildThreads(comments);

  assert.equal(threads.length, 1);
  assert.equal(threads[0]?.id, 1);
  assert.deepEqual(threads[0]?.comments.map((c) => c.id), [1, 2, 3]);
});

test('a reply whose parent is missing becomes its own thread', () => {
  const comments = parseReviewComments([raw({ id: 9, in_reply_to_id: 404 })]);

  const threads = buildThreads(comments);

  assert.equal(threads.length, 1);
  assert.equal(threads[0]?.id, 9);
});

test('indexes threads by side and line, and sets outdated ones aside', () => {
  const threads = buildThreads(parseReviewComments([
    raw({ id: 1, line: 10, side: 'RIGHT' }),
    raw({ id: 2, line: 10, side: 'LEFT', created_at: '2026-09-01T10:01:00Z' }),
    raw({ id: 3, line: null, original_line: 7, created_at: '2026-09-01T10:02:00Z' }),
    raw({ id: 4, path: 'src/other.ts', created_at: '2026-09-01T10:03:00Z' }),
  ]));

  const { byRow, detached } = indexThreadsForFile(threads, 'src/a.ts');

  assert.equal(byRow.get(rowKey('RIGHT', 10))?.length, 1);
  assert.equal(byRow.get(rowKey('LEFT', 10))?.length, 1);
  assert.equal(detached.length, 1);
  assert.equal(detached[0]?.id, 3);
  // The other file's thread is not this file's problem.
  assert.equal([...byRow.values()].flat().some((t) => t.path !== 'src/a.ts'), false);
});
