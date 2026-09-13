/**
 * Review comments: the shapes the forge returns, and how they map onto rows.
 *
 * The API hands back a flat list of comments; a reader thinks in threads
 * anchored to lines. This module does that conversion and nothing else, so the
 * part most likely to be wrong is the part that can be tested without a browser.
 */

/**
 * Which side of the diff a comment is attached to.
 *
 * `RIGHT` is the head revision, which is where all but deletions live.
 */
export type DiffSide = 'LEFT' | 'RIGHT';

/**
 * One review comment, reduced to what the viewer needs.
 */
export interface ReviewComment {
  /** The forge's id, used to thread replies onto their parent. */
  id: number;
  /** Repository-relative path of the file commented on. */
  path: string;
  /** Line the comment sits on, in the revision named by `side`. */
  line: number | null;
  /** First line of a multi-line comment, when it spans a range. */
  startLine: number | null;
  /** Which revision `line` refers to. */
  side: DiffSide;
  /** The comment text, as written, in Markdown. */
  body: string;
  /** Who wrote it. */
  author: string;
  /** When, as an ISO timestamp. */
  createdAt: string;
  /** The comment this one replies to, if any. */
  inReplyToId: number | null;
  /** Link back to the comment on the forge. */
  url: string;
  /**
   * True when the code the comment was written against has since changed, so
   * the forge no longer knows which line it belongs on.
   */
  outdated: boolean;
}

/**
 * A comment and the replies under it.
 */
export interface ReviewThread {
  /** The id of the comment that started the thread. */
  id: number;
  /** Path of the file the thread is on. */
  path: string;
  /** Line it is anchored to, or null when the anchor was lost. */
  line: number | null;
  /** Which revision the line refers to. */
  side: DiffSide;
  /** True when the thread no longer has a live anchor. */
  outdated: boolean;
  /** The root comment first, then replies in the order they were written. */
  comments: ReviewComment[];
}

/**
 * Read the forge's JSON into the shape the viewer wants.
 *
 * Anything unrecognisable is dropped rather than guessed at: a comment without
 * a path or an id cannot be placed, and inventing a position for it would put
 * someone's words against the wrong line.
 *
 * @param raw - The parsed JSON array from the pull request comments endpoint.
 * @returns The comments that could be understood.
 */
export function parseReviewComments(raw: unknown): ReviewComment[] {
  if (!Array.isArray(raw)) return [];
  const comments: ReviewComment[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item['id'] === 'number' ? item['id'] : null;
    const path = typeof item['path'] === 'string' ? item['path'] : null;
    if (id === null || !path) continue;

    // A comment whose code has changed loses `line` but keeps `original_line`,
    // which is still the best anchor available for showing it.
    const live = typeof item['line'] === 'number' ? item['line'] : null;
    const original = typeof item['original_line'] === 'number' ? item['original_line'] : null;
    const user = item['user'] as { login?: unknown } | undefined;

    comments.push({
      id,
      path,
      line: live ?? original,
      startLine: typeof item['start_line'] === 'number' ? item['start_line'] : null,
      side: item['side'] === 'LEFT' ? 'LEFT' : 'RIGHT',
      body: typeof item['body'] === 'string' ? item['body'] : '',
      author: typeof user?.login === 'string' ? user.login : 'unknown',
      createdAt: typeof item['created_at'] === 'string' ? item['created_at'] : '',
      inReplyToId: typeof item['in_reply_to_id'] === 'number' ? item['in_reply_to_id'] : null,
      url: typeof item['html_url'] === 'string' ? item['html_url'] : '',
      outdated: live === null && original !== null,
    });
  }

  return comments;
}

/**
 * Group comments into threads, root first, replies in order.
 *
 * A reply carries the id of the comment it answers, which may itself be a
 * reply, so the root is found by walking that chain rather than by taking the
 * parent. A reply whose parent is missing becomes its own thread instead of
 * being dropped.
 *
 * @param comments - Comments for one pull request.
 * @returns One thread per root comment, in the order the roots were written.
 */
export function buildThreads(comments: ReviewComment[]): ReviewThread[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));

  /**
   * Walk up the reply chain to the comment that started the thread.
   *
   * @param comment - Any comment in the thread.
   * @returns The root comment.
   */
  function rootOf(comment: ReviewComment): ReviewComment {
    const seen = new Set<number>();
    let current = comment;
    while (current.inReplyToId !== null && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = byId.get(current.inReplyToId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  const threads = new Map<number, ReviewThread>();
  const ordered = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);

  for (const comment of ordered) {
    const root = rootOf(comment);
    let thread = threads.get(root.id);
    if (!thread) {
      thread = {
        id: root.id,
        path: root.path,
        line: root.line,
        side: root.side,
        outdated: root.outdated,
        comments: [],
      };
      threads.set(root.id, thread);
    }
    thread.comments.push(comment);
  }

  return [...threads.values()];
}

/**
 * The key a thread is filed under, so the viewer can look one up per row.
 *
 * @param side - Which revision the line belongs to.
 * @param line - The line number.
 * @returns A key combining the two.
 */
export function rowKey(side: DiffSide, line: number): string {
  return `${side}:${line}`;
}

/**
 * Index one file's threads by the row they belong under.
 *
 * Threads that lost their anchor are not indexed: they are shown above the file
 * instead, where they cannot imply a line they no longer have.
 *
 * @param threads - Threads for the whole pull request.
 * @param path - The file being rendered.
 * @returns Threads by row key, and the ones with no usable anchor.
 */
export function indexThreadsForFile(
  threads: ReviewThread[],
  path: string,
): { byRow: Map<string, ReviewThread[]>; detached: ReviewThread[] } {
  const byRow = new Map<string, ReviewThread[]>();
  const detached: ReviewThread[] = [];

  for (const thread of threads) {
    if (thread.path !== path) continue;
    if (thread.line === null || thread.outdated) {
      detached.push(thread);
      continue;
    }
    const key = rowKey(thread.side, thread.line);
    const existing = byRow.get(key);
    if (existing) existing.push(thread);
    else byRow.set(key, [thread]);
  }

  return { byRow, detached };
}
