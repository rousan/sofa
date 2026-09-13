/**
 * Where the forge tokens live.
 *
 * A token is stored per host, because a GitHub Enterprise instance and
 * github.com are different accounts with different credentials. They are kept
 * in the extension's own storage rather than the page's: a content script's
 * storage is readable by anything else running on that origin, and a token that
 * can write review comments has no business being there.
 */

/**
 * The storage key holding the map of host to token.
 */
const TOKEN_KEY = 'sofa:tokens';

/**
 * Read every stored token.
 *
 * @returns Tokens by host, empty when none are stored.
 */
export async function loadTokens(): Promise<Record<string, string>> {
  try {
    const stored = await chrome.storage.local.get(TOKEN_KEY);
    const value = stored[TOKEN_KEY] as unknown;
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(([, token]) => typeof token === 'string'),
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Read the token for one host.
 *
 * @param host - The forge's hostname.
 * @returns The token, or null when that host has none.
 */
export async function tokenFor(host: string): Promise<string | null> {
  const tokens = await loadTokens();
  return tokens[host] ?? null;
}

/**
 * Store or clear the token for one host.
 *
 * @param host - The forge's hostname.
 * @param token - The token, or an empty string to forget it.
 */
export async function saveToken(host: string, token: string): Promise<void> {
  const tokens = await loadTokens();
  if (token.trim()) tokens[host] = token.trim();
  else delete tokens[host];
  await chrome.storage.local.set({ [TOKEN_KEY]: tokens });
}

/**
 * The API root for a forge host.
 *
 * github.com serves its API from a separate domain; every Enterprise server
 * serves it from `/api/v3` on the same host as the pages.
 *
 * @param host - The forge's hostname.
 * @returns The base URL to build API paths on.
 */
export function apiBase(host: string): string {
  if (host === 'github.com') return 'https://api.github.com';
  return `https://${host}/api/v3`;
}
