/**
 * All network and page access against the forge.
 *
 * Sofa deliberately avoids the REST API and personal access tokens: every
 * request here is a same-origin request that reuses the browser session, so the
 * same code works on github.com and on any GitHub Enterprise host, private
 * repositories included.
 *
 * Two endpoints carry everything:
 *   - `<pull-request>.diff`   the whole pull request as one unified diff
 *   - `/raw/<sha>/<path>`     the full text of one file at the head commit
 */
import { parseUnifiedDiff } from './diff.ts';
import type { DiffFile, PrContext } from './types.ts';

/**
 * Cache of fetched file text, keyed by commit sha and path.
 *
 * A file's content at a fixed sha never changes, so caching for the lifetime of
 * the page makes revisiting a file free.
 */
const fileCache = new Map<string, string | null>();

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
 * Fetch a URL as text using the browser's forge session.
 *
 * @param url - Absolute URL to fetch.
 * @returns The response body.
 * @throws When the response status is not ok.
 */
export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'text/plain, */*' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

/**
 * Fetch and parse the pull request's complete unified diff.
 *
 * @param ctx - The pull request being reviewed.
 * @returns One record per changed file.
 */
export async function fetchFiles(ctx: PrContext): Promise<DiffFile[]> {
  const text = await fetchText(`${ctx.origin}/${ctx.owner}/${ctx.repo}/pull/${ctx.number}.diff`);
  return parseUnifiedDiff(text);
}

/**
 * Look for the head sha in the JSON payloads the pull request page embeds.
 *
 * @returns The sha, or null when no payload carries one.
 */
function findShaInEmbeddedData(): string | null {
  for (const script of document.querySelectorAll('script[type="application/json"]')) {
    const text = script.textContent ?? '';
    const match = /"headRefOid"\s*:\s*"([0-9a-f]{40})"/.exec(text)
      ?? /"head_sha"\s*:\s*"([0-9a-f]{40})"/.exec(text);
    if (match?.[1]) return match[1];
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="octolytics-dimension-pull_request_head_sha"]');
  if (meta && /^[0-9a-f]{40}$/.test(meta.content)) return meta.content;
  return null;
}

/**
 * Look for the head sha in the repository blob links the page renders.
 *
 * The per-file "View file" link on the Files changed tab points at the head
 * commit, which makes it a reliable source on older Enterprise releases.
 *
 * @param ctx - The pull request being reviewed.
 * @returns The sha, or null when no such link is present.
 */
function findShaInBlobLinks(ctx: PrContext): string | null {
  const prefix = `/${ctx.owner}/${ctx.repo}/blob/`;
  const pattern = new RegExp(`${prefix.replace(/\//g, '\\/')}([0-9a-f]{40})/`);
  for (const link of document.querySelectorAll('a[href]')) {
    const match = pattern.exec(link.getAttribute('href') ?? '');
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Find the head commit sha of the pull request.
 *
 * Sources are tried in cost order: the JSON the page already embeds, then any
 * blob link on the page, then the `.patch` document whose last commit is the
 * head commit. The two DOM sources are free, which matters because nothing can
 * be rendered as a whole file until the sha is known.
 *
 * @param ctx - The pull request being reviewed.
 * @returns A 40-character sha, or null when none could be determined.
 */
export async function resolveHeadSha(ctx: PrContext): Promise<string | null> {
  const embedded = findShaInEmbeddedData();
  if (embedded) return embedded;

  const linked = findShaInBlobLinks(ctx);
  if (linked) return linked;

  try {
    const patch = await fetchText(`${ctx.origin}/${ctx.owner}/${ctx.repo}/pull/${ctx.number}.patch`);
    const matches = patch.match(/^From ([0-9a-f]{40}) /gm);
    if (matches?.length) {
      // Commits appear oldest first, so the last one is the pull request head.
      const last = matches[matches.length - 1] ?? '';
      return /([0-9a-f]{40})/.exec(last)?.[1] ?? null;
    }
  } catch {
    // Fall through: the viewer degrades to a hunks-only rendering.
  }
  return null;
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
 * Fetch the full text of one file at a given commit.
 *
 * @param ctx - The pull request being reviewed.
 * @param sha - Commit sha to read the file at.
 * @param path - Repository-relative path of the file.
 * @returns The file text, or null when it is unavailable (absent at that sha,
 *   too large to serve, or a transport error).
 */
export async function fetchFileAtSha(ctx: PrContext, sha: string | null, path: string): Promise<string | null> {
  if (!sha) return null;
  const key = `${sha}:${path}`;
  const cached = fileCache.get(key);
  if (cached !== undefined) return cached;

  let text: string | null = null;
  try {
    text = await fetchText(`${ctx.origin}/${ctx.owner}/${ctx.repo}/raw/${sha}/${encodePath(path)}`);
  } catch {
    text = null;
  }
  fileCache.set(key, text);
  return text;
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
