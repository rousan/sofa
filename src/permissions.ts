/**
 * Shared logic for the hosts Sofa may run on.
 *
 * The published extension ships with permission for github.com only. Any other
 * forge, such as a company's GitHub Enterprise server, is granted by the user at
 * runtime from the popup, and this module holds the pieces both the popup and
 * the service worker need to agree on.
 */

/**
 * Origins the manifest grants at install time, which the user cannot revoke and
 * which must never be treated as one of their own additions.
 */
export const BUILT_IN_ORIGINS = ['*://github.com/*', '*://raw.githubusercontent.com/*'];

/**
 * Prefix for the content script registrations Sofa creates at runtime, so its
 * own registrations can be told apart from anything else in the browser.
 */
export const SCRIPT_ID_PREFIX = 'sofa:';

/**
 * Turn whatever the user typed into a Chrome match pattern.
 *
 * Accepts a bare hostname, a URL, or a pattern already in the right shape, so
 * pasting an address bar's contents works.
 *
 * @param input - The raw text from the popup's host field.
 * @returns A match pattern such as `*://ghe.example.com/*`, or null if the text
 *   does not name a plausible host.
 */
export function toMatchPattern(input: string): string | null {
  const host = input
    .trim()
    .replace(/^\*:\/\//, '')
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

  // One concrete, dotted hostname only. A wildcard host is refused on purpose:
  // typing `*` must never be a way to grant Sofa every site at once.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) return null;
  return `*://${host}/*`;
}

/**
 * The readable hostname inside a match pattern, for display.
 *
 * @param pattern - A match pattern produced by `toMatchPattern`.
 * @returns The hostname it covers.
 */
export function hostOf(pattern: string): string {
  return pattern.replace(/^\*:\/\//, '').replace(/\/\*$/, '');
}

/**
 * The origins the user has added, in sorted order.
 *
 * @returns Granted match patterns, excluding the ones the manifest ships with.
 */
export async function grantedHosts(): Promise<string[]> {
  const all = await chrome.permissions.getAll();
  return (all.origins ?? []).filter((origin) => !BUILT_IN_ORIGINS.includes(origin)).sort();
}
