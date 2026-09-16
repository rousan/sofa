/**
 * Everything Sofa reads from the forge.
 *
 * All of it goes through the forge's API, with a token the user supplies. The
 * browser session cannot be used: the API does not accept cookies, and the
 * routes that do accept them proved unreliable in both directions. github.com
 * redirects a pull request's diff to a host a content script may not fetch, and
 * GitHub Enterprise redirects it to a media path that refuses anything
 * attributed to an extension. The API has neither problem, and it knows the
 * head commit rather than leaving it to be inferred from the page.
 *
 * The token lives in the service worker, so nothing here ever handles it: this
 * asks for a path and gets a body back.
 */
import { buildThreads, parseReviewComments, parseUnifiedDiff } from '@sofa/core';
import type { DiffFile, PrContext, ReviewThread } from '@sofa/core';

/**
 * Cache of fetched file text, keyed by commit sha and path.
 *
 * A file's content at a fixed sha never changes, so caching for the lifetime of
 * the page makes revisiting a file free.
 */
const fileCache = new Map<string, string | null>();

/**
 * Fetches currently in flight, keyed the same way as the cache.
 *
 * Prefetching and clicking race for the same file constantly, and without this
 * the click would start a second request for something already on its way.
 */
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Why a read failed, in the only terms the panel needs to tell them apart.
 *
 * `needs-token` is the ordinary case on a private repository with no token
 * configured, and is answered with an explanation rather than an error.
 */
export type ReadError = 'needs-token' | 'failed';

/**
 * What the API gave back.
 */
interface ApiResult<T> {
  /** The body, when the call succeeded. */
  body: T | null;
  /** Why it did not, when it failed. */
  error: ReadError | null;
}

/**
 * Recognise a pull request URL and extract its coordinates.
 *
 * @param location - Location to parse; defaults to the current page's.
 * @returns The pull request context, or null when this is not a pull request.
 */
export function parseLocation(location: Location | URL = window.location): PrContext | null {
  const match = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/([^/?#]+))?/.exec(location.pathname);
  if (!match) return null;
  return {
    origin: location.origin,
    owner: match[1] ?? '',
    repo: match[2] ?? '',
    number: Number(match[3]),
    tab: match[4] ?? 'conversation',
  };
}

/**
 * Ask the service worker to call the forge's API.
 *
 * @param path - API path, such as `/repos/o/r/pulls/1`.
 * @param accept - The media type to ask for: JSON by default, a unified diff or
 *   a raw file when those are wanted.
 * @returns The body, or the reason it could not be had.
 */
async function api<T>(path: string, accept?: string): Promise<ApiResult<T>> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return { body: null, error: 'failed' };
  }
  try {
    const reply = await chrome.runtime.sendMessage({ kind: 'sofa:api', path, accept }) as
      { ok?: boolean; body?: unknown; error?: string } | undefined;
    if (reply?.ok) return { body: (reply.body ?? null) as T | null, error: null };
    return { body: null, error: reply?.error === 'needs-token' ? 'needs-token' : 'failed' };
  } catch {
    return { body: null, error: 'failed' };
  }
}

/**
 * Encode a repository path for use in a URL, one segment at a time.
 *
 * @param path - Repository-relative path.
 * @returns The path with each segment percent-encoded.
 */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Fetch the pull request's changed files and its head commit together.
 *
 * They arrive from two calls to the same endpoint, one asking for the diff and
 * one for the metadata, so they are fetched side by side and returned as a
 * pair: neither is useful without the other.
 *
 * @param ctx - The pull request being reviewed.
 * @returns The files and head sha, or the reason they could not be read.
 */
export async function fetchPullRequest(
  ctx: PrContext,
): Promise<{ files: DiffFile[]; headSha: string | null; error: ReadError | null }> {
  const base = `/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.number}`;
  const [diff, meta] = await Promise.all([
    api<string>(base, 'application/vnd.github.diff'),
    api<{ head?: { sha?: unknown } }>(base),
  ]);

  if (diff.error || typeof diff.body !== 'string') {
    return { files: [], headSha: null, error: diff.error ?? 'failed' };
  }

  const sha = meta.body?.head?.sha;
  return {
    files: parseUnifiedDiff(diff.body),
    headSha: typeof sha === 'string' && /^[0-9a-f]{40}$/.test(sha) ? sha : null,
    error: null,
  };
}

/**
 * Fetch the full text of one file at a given commit.
 *
 * @param ctx - The pull request being reviewed.
 * @param sha - Commit sha to read the file at.
 * @param path - Repository-relative path of the file.
 * @returns The file text, or null when it is unavailable, which a deleted file,
 *   a binary, or a token without Contents access all produce.
 */
export async function fetchFileAtSha(ctx: PrContext, sha: string | null, path: string): Promise<string | null> {
  if (!sha) return null;
  const key = `${sha}:${path}`;
  const cached = fileCache.get(key);
  if (cached !== undefined) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const result = await api<string>(
      `/repos/${ctx.owner}/${ctx.repo}/contents/${encodePath(path)}?ref=${sha}`,
      'application/vnd.github.raw',
    );
    const text = typeof result.body === 'string' ? result.body : null;
    fileCache.set(key, text);
    inFlight.delete(key);
    return text;
  })();

  inFlight.set(key, request);
  return request;
}

/**
 * Fetch the pull request's review comments, threaded.
 *
 * @param ctx - The pull request being reviewed.
 * @returns The threads, and the reason there are none when that is why.
 */
export async function fetchReviewThreads(
  ctx: PrContext,
): Promise<{ threads: ReviewThread[]; error: ReadError | null }> {
  const result = await api<unknown>(
    `/repos/${ctx.owner}/${ctx.repo}/pulls/${ctx.number}/comments?per_page=100`,
  );
  if (result.error) return { threads: [], error: result.error };
  return { threads: buildThreads(parseReviewComments(result.body)), error: null };
}

/**
 * Build the forge URL that shows one file at the pull request's head commit.
 *
 * @param ctx - The pull request being reviewed.
 * @param sha - Head commit sha, when known.
 * @param path - Repository-relative path of the file.
 * @returns A URL suitable for an "open on GitHub" link.
 */
export function blobUrl(ctx: PrContext, sha: string | null, path: string): string {
  if (sha) return `${ctx.origin}/${ctx.owner}/${ctx.repo}/blob/${sha}/${encodePath(path)}`;
  return `${ctx.origin}/${ctx.owner}/${ctx.repo}/pull/${ctx.number}/files`;
}
