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
 * How long to wait for the page-world bridge before deciding it is not there.
 */
const BRIDGE_TIMEOUT_MS = 4000;

/**
 * Whether the page-world bridge has ever answered.
 *
 * Once it has failed to reply, later requests skip it rather than pay the
 * timeout again. The offline harness, where no bridge is injected, hits this.
 */
let bridgeAvailable: boolean | null = null;

/**
 * The reply shape the page-world bridge posts back.
 */
interface BridgeReply {
  /** Whether the response status was in the success range. */
  ok: boolean;
  /** HTTP status, or 0 when the request never completed. */
  status: number;
  /** HTTP status text, or a short reason when the request never completed. */
  statusText: string;
  /** The body, empty unless `ok`. */
  text: string;
}

/**
 * Fetch a URL through the page-world bridge.
 *
 * @param url - Absolute, same-origin URL to fetch.
 * @returns The bridge's reply, or null when no bridge answered in time.
 */
function fetchViaPage(url: string): Promise<BridgeReply | null> {
  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      bridgeAvailable = false;
      resolve(null);
    }, BRIDGE_TIMEOUT_MS);

    /**
     * Resolve the promise when the bridge answers this particular request.
     *
     * @param event - A message event on the page's window.
     */
    function onMessage(event: MessageEvent): void {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { kind?: string; id?: string } | undefined;
      if (!data || data.kind !== 'sofa:fetch-response' || data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      bridgeAvailable = true;
      resolve(data as unknown as BridgeReply);
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ kind: 'sofa:fetch-request', id, url }, window.location.origin);
  });
}

/**
 * Fetch a URL through the extension's service worker.
 *
 * @param url - Absolute URL to fetch.
 * @returns The worker's reply, or null when there is no worker to ask.
 */
async function fetchViaWorker(url: string): Promise<BridgeReply | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null;
  try {
    const reply = await chrome.runtime.sendMessage({ kind: 'sofa:fetch', url });
    return (reply as BridgeReply | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL as text from the content script's own context.
 *
 * @param url - Absolute URL to fetch.
 * @returns The response body.
 * @throws When the response status is not ok.
 */
async function fetchDirect(url: string): Promise<string> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'text/plain, */*' },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  return response.text();
}

/**
 * Fetch a URL as text using the browser's forge session.
 *
 * Three routes, because no single one works everywhere:
 *
 *  - The service worker. The canonical Manifest V3 route, and the only one with
 *    a CORS exemption, which github.com needs: its `.diff` redirects to
 *    patch-diff.githubusercontent.com, and a content script's own fetch of that
 *    is rejected for a missing allow-origin header.
 *  - The page-world bridge. Needed where a forge refuses requests attributed to
 *    the extension: GitHub Enterprise redirects `.diff` to a media path that
 *    answers 403 to those while serving the identical URL to the page.
 *  - A direct fetch, which is all the offline harness has.
 *
 * @param url - Absolute URL to fetch.
 * @returns The response body.
 * @throws When no route could fetch it.
 */
export async function fetchText(url: string): Promise<string> {
  const viaWorker = await fetchViaWorker(url);
  if (viaWorker?.ok) return viaWorker.text;

  const sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
  const hasBridge = document.documentElement.hasAttribute('data-sofa-bridge');
  if (sameOrigin && hasBridge && bridgeAvailable !== false) {
    const viaPage = await fetchViaPage(url);
    if (viaPage?.ok) return viaPage.text;
    if (viaPage && viaWorker) {
      // Both privileged routes answered and both refused, so the forge means it.
      throw new Error(`${viaWorker.status || viaPage.status} ${viaWorker.statusText || viaPage.statusText}`.trim());
    }
  }

  return fetchDirect(url);
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
 * Find the head commit sha of the pull request, cheaply.
 *
 * Both sources are free, which matters because nothing can be rendered as a
 * whole file until a sha is known. Neither is authoritative, though: a page's
 * embedded payloads vary by forge version, and a blob link can point at some
 * other commit entirely (a reviewer linking a file from a comment, say). A
 * wrong sha shows up as a file whose text does not match the diff, at which
 * point the panel asks `confirmHeadSha` for the real answer.
 *
 * @param ctx - The pull request being reviewed.
 * @returns A 40-character sha, or null when neither source had one.
 */
export async function resolveHeadSha(ctx: PrContext): Promise<string | null> {
  return findShaInEmbeddedData() ?? findShaInBlobLinks(ctx) ?? confirmHeadSha(ctx);
}

/**
 * Cache of the authoritative head sha, so the patch is fetched at most once.
 */
const confirmedShas = new Map<string, string | null>();

/**
 * Read the head commit sha from the pull request's own patch.
 *
 * This is the authoritative source: `.patch` lists the pull request's commits
 * oldest first, so the last one is its head. It costs a request roughly the
 * size of the diff, which is why it is only used to confirm a guess that has
 * already proved wrong.
 *
 * @param ctx - The pull request being reviewed.
 * @returns A 40-character sha, or null when the patch could not be read.
 */
export async function confirmHeadSha(ctx: PrContext): Promise<string | null> {
  const key = `${ctx.origin}/${ctx.owner}/${ctx.repo}#${ctx.number}`;
  const cached = confirmedShas.get(key);
  if (cached !== undefined) return cached;

  let sha: string | null = null;
  try {
    const patch = await fetchText(`${ctx.origin}/${ctx.owner}/${ctx.repo}/pull/${ctx.number}.patch`);
    const matches = patch.match(/^From ([0-9a-f]{40}) /gm);
    const last = matches?.[matches.length - 1] ?? '';
    sha = /([0-9a-f]{40})/.exec(last)?.[1] ?? null;
  } catch {
    // Leave it null: the viewer degrades to a hunks-only rendering.
  }
  confirmedShas.set(key, sha);
  return sha;
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
