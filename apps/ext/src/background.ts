/**
 * Service worker: keeps Sofa running on the hosts the user has granted.
 *
 * A content script declared in the manifest only covers hosts known when the
 * extension was built. Granting a permission at runtime does not, on its own,
 * make the script run there, so every granted host gets a matching dynamic
 * content script registration, added when permission is granted and removed
 * when it is revoked.
 */
import { SCRIPT_ID_PREFIX, grantedHosts, hostOf } from './permissions.ts';
import { apiBase, tokenFor } from './tokens.ts';

/**
 * The registration id used for one origin.
 *
 * @param origin - A granted match pattern.
 * @returns A stable id, so re-running the sync never duplicates a registration.
 */
function scriptId(origin: string): string {
  return `${SCRIPT_ID_PREFIX}${origin}`;
}

/**
 * Make the registered content scripts match the granted permissions exactly.
 *
 * Runs on install, on browser start, and whenever a permission changes. It is
 * written to converge from any starting state, because registrations persist
 * across sessions and can outlive the permission that justified them.
 */
async function syncRegistrations(): Promise<void> {
  const wanted = new Map((await grantedHosts()).map((origin) => [scriptId(origin), origin]));
  const existing = await chrome.scripting.getRegisteredContentScripts();

  const stale = existing
    .filter((script) => script.id.startsWith(SCRIPT_ID_PREFIX) && !wanted.has(script.id.replace(/#bridge$/, '')))
    .map((script) => script.id);
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });

  const already = new Set(existing.map((script) => script.id));
  const missing = [...wanted]
    .filter(([id]) => !already.has(id))
    .map(([id, origin]) => ({
      id,
      matches: [origin],
      js: ['content.js'],
      css: ['sofa.css'],
      runAt: 'document_end' as const,
      persistAcrossSessions: true,
    }));
  if (missing.length) await chrome.scripting.registerContentScripts(missing);
}

/**
 * Call the forge's API on behalf of a content script.
 *
 * The token is attached here and never leaves the extension: the content script
 * asks for a path, not for a credential. The host comes from the sender, so a
 * page can only ever reach the API of the forge it is itself served from.
 *
 * @param path - An API path such as `/repos/o/r/pulls/1/comments`.
 * @param sender - Who asked, which decides both the host and the token.
 * @returns The parsed body, or an error the caller can show.
 */
async function callApi(
  path: string,
  sender: chrome.runtime.MessageSender,
  accept?: string,
  requestedHost?: string,
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
  if (!origin) return { ok: false, status: 0, body: null, error: 'unknown sender' };

  // A content script's host is the page it runs on, which is the only API it
  // may reach. The popup is an extension page with no forge of its own, so it
  // names the host, and may only name one Sofa actually runs on.
  let host = new URL(origin).hostname;
  if (origin.startsWith('chrome-extension://')) {
    const asked = typeof requestedHost === 'string' ? requestedHost : '';
    const allowed = asked === 'github.com'
      || (await grantedHosts()).some((pattern) => hostOf(pattern) === asked);
    if (!allowed) return { ok: false, status: 0, body: null, error: 'host not allowed' };
    host = asked;
  }
  const token = await tokenFor(host);

  // A token is only needed for what the reader cannot already see: a public
  // repository's comments are public, so an unauthenticated call is tried and
  // costs the user no setup at all.
  const headers: Record<string, string> = {
    // The same endpoint serves JSON, a unified diff or a raw file depending on
    // what is asked for, which is why the caller chooses.
    Accept: accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${apiBase(host)}${path}`, { headers });
    const wantsText = Boolean(accept && !accept.includes('json'));
    return {
      ok: response.ok,
      status: response.status,
      body: response.ok ? (wantsText ? await response.text() : await response.json()) : null,
      // 401 and 404 both mean "not without a token" here: the forge hides a
      // private repository rather than admitting it exists.
      error: response.ok
        ? undefined
        : response.status === 401 || response.status === 403 || response.status === 404
          ? 'needs-token'
          : `${response.status} ${response.statusText}`.trim(),
    };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: err instanceof Error ? err.message : 'failed' };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const request = message as
    { kind?: string; url?: string; path?: string; accept?: string; host?: string } | undefined;

  if (request?.kind === 'sofa:api' && typeof request.path === 'string') {
    void callApi(request.path, sender, request.accept, request.host).then(sendResponse);
    // Keeps the message channel open for the asynchronous reply.
    return true;
  }

  return undefined;
});

chrome.runtime.onInstalled.addListener(() => void syncRegistrations());
chrome.runtime.onStartup.addListener(() => void syncRegistrations());
chrome.permissions.onAdded.addListener(() => void syncRegistrations());
chrome.permissions.onRemoved.addListener(() => void syncRegistrations());
