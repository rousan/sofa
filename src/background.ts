/**
 * Service worker: keeps Sofa running on the hosts the user has granted.
 *
 * A content script declared in the manifest only covers hosts known when the
 * extension was built. Granting a permission at runtime does not, on its own,
 * make the script run there, so every granted host gets a matching dynamic
 * content script registration, added when permission is granted and removed
 * when it is revoked.
 */
import { SCRIPT_ID_PREFIX, grantedHosts } from './permissions.ts';

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
    .flatMap(([id, origin]) => [
      {
        id,
        matches: [origin],
        js: ['content.js'],
        css: ['sofa.css'],
        runAt: 'document_end' as const,
        persistAcrossSessions: true,
      },
      // The bridge mirrors the manifest's own main-world entry: without it,
      // fetches on this host would be attributed to the extension, which some
      // forges answer 403 to.
      {
        id: `${id}#bridge`,
        matches: [origin],
        js: ['fetch-bridge.js'],
        runAt: 'document_start' as const,
        world: 'MAIN' as const,
        persistAcrossSessions: true,
      },
    ]);
  if (missing.length) await chrome.scripting.registerContentScripts(missing);
}

/**
 * Fetch one URL on behalf of a content script.
 *
 * This is where a cross-origin fetch has to happen: in Manifest V3 a content
 * script gets no CORS exemption from the extension's host permissions, so its
 * own request for github.com's `.diff` fails the moment GitHub redirects it to
 * patch-diff.githubusercontent.com. The service worker does have that
 * exemption, and sends the user's cookies with it.
 *
 * Only the sender's own origin may be fetched, so a page Sofa runs on can never
 * use this to read some other site with the user's credentials.
 *
 * @param url - Absolute URL the content script asked for.
 * @param sender - Who asked, used to constrain the origin.
 * @returns The status and body, shaped for the caller to inspect.
 */
async function fetchForContentScript(
  url: string,
  sender: chrome.runtime.MessageSender,
): Promise<{ ok: boolean; status: number; statusText: string; text: string }> {
  const senderOrigin = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
  if (!senderOrigin || new URL(url).origin !== senderOrigin) {
    return { ok: false, status: 0, statusText: 'cross-origin', text: '' };
  }
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'text/plain, */*' },
      redirect: 'follow',
    });
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text: response.ok ? await response.text() : '',
    };
  } catch (err) {
    return { ok: false, status: 0, statusText: err instanceof Error ? err.message : 'failed', text: '' };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const request = message as { kind?: string; url?: string } | undefined;
  if (request?.kind !== 'sofa:fetch' || typeof request.url !== 'string') return undefined;
  void fetchForContentScript(request.url, sender).then(sendResponse);
  // Keeps the message channel open for the asynchronous reply.
  return true;
});

chrome.runtime.onInstalled.addListener(() => void syncRegistrations());
chrome.runtime.onStartup.addListener(() => void syncRegistrations());
chrome.permissions.onAdded.addListener(() => void syncRegistrations());
chrome.permissions.onRemoved.addListener(() => void syncRegistrations());
