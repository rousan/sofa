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
    .filter((script) => script.id.startsWith(SCRIPT_ID_PREFIX) && !wanted.has(script.id))
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

chrome.runtime.onInstalled.addListener(() => void syncRegistrations());
chrome.runtime.onStartup.addListener(() => void syncRegistrations());
chrome.permissions.onAdded.addListener(() => void syncRegistrations());
chrome.permissions.onRemoved.addListener(() => void syncRegistrations());
