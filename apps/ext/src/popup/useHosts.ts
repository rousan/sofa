/**
 * The popup's state: which hosts Sofa may run on, and whether each has a
 * working token.
 *
 * All the awkwardness of talking to Chrome lives here so the components can be
 * about layout. Nothing is cached: a popup is open for seconds at a time, and
 * stale permission state is worse than a second request.
 */
import { useCallback, useEffect, useState } from 'react';
import { grantedHosts, hostOf, toMatchPattern } from '../permissions.ts';
import { loadTokens, saveToken } from '../tokens.ts';

/**
 * Whether a host's token has been checked, and what came back.
 */
export type TokenState =
  | { status: 'none' }
  | { status: 'checking' }
  | { status: 'ok'; login: string }
  | { status: 'bad'; reason: string };

/**
 * One row of the popup: a host, whether Sofa may run there, and its token.
 */
export interface HostEntry {
  /** The hostname, such as github.com. */
  host: string;
  /** True for github.com, which ships in the manifest and cannot be removed. */
  builtIn: boolean;
  /** The match pattern Chrome granted, for removing it again. */
  origin: string | null;
  /** Whether a token is stored, and whether it works. */
  token: TokenState;
}

/**
 * Ask the forge who a token belongs to.
 *
 * It doubles as validation: a token that cannot name its own user is not going
 * to fetch anyone's pull request.
 *
 * @param host - The forge to ask.
 * @returns The state to show for that host.
 */
async function checkToken(host: string): Promise<TokenState> {
  const tokens = await loadTokens();
  if (!tokens[host]) return { status: 'none' };

  try {
    const reply = await chrome.runtime.sendMessage({ kind: 'sofa:api', path: '/user', host }) as
      { ok?: boolean; body?: { login?: string }; status?: number } | undefined;
    if (reply?.ok && typeof reply.body?.login === 'string') {
      return { status: 'ok', login: reply.body.login };
    }
    return { status: 'bad', reason: reply?.status === 401 ? 'not accepted' : 'could not be checked' };
  } catch {
    return { status: 'bad', reason: 'could not be checked' };
  }
}

/**
 * Load the hosts and their token states, and expose the actions on them.
 *
 * @returns The list, a loading flag, and the four things the popup can do.
 */
export function useHosts() {
  const [entries, setEntries] = useState<HostEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const patterns = await grantedHosts();
    const hosts: HostEntry[] = [
      { host: 'github.com', builtIn: true, origin: null, token: { status: 'checking' } },
      ...patterns.map((origin) => ({
        host: hostOf(origin),
        builtIn: false,
        origin,
        token: { status: 'checking' } as TokenState,
      })),
    ];
    setEntries(hosts);
    setLoading(false);

    // Checked one at a time so a slow forge cannot hold up the rest of the list.
    for (const entry of hosts) {
      const token = await checkToken(entry.host);
      setEntries((current) => current.map((row) => (row.host === entry.host ? { ...row, token } : row)));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Ask Chrome for permission to run on a host the user named.
   *
   * @param input - Whatever they typed: a hostname, a URL, or a pattern.
   * @returns An error to show, or null when the host was added.
   */
  const addHost = useCallback(async (input: string): Promise<string | null> => {
    const pattern = toMatchPattern(input);
    if (!pattern) return 'That does not look like a hostname.';
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) return 'Permission was not granted.';
    await refresh();
    return null;
  }, [refresh]);

  /**
   * Give back a host's permission, and forget its token with it.
   *
   * @param entry - The row being removed.
   */
  const removeHost = useCallback(async (entry: HostEntry) => {
    if (!entry.origin) return;
    await chrome.permissions.remove({ origins: [entry.origin] });
    await saveToken(entry.host, '');
    await refresh();
  }, [refresh]);

  /**
   * Store a token for one host and check it straight away.
   *
   * @param host - The forge the token belongs to.
   * @param token - The token, or an empty string to forget it.
   */
  const setToken = useCallback(async (host: string, token: string) => {
    setEntries((current) => current.map((row) => (
      row.host === host ? { ...row, token: { status: 'checking' } } : row
    )));
    await saveToken(host, token);
    const state = await checkToken(host);
    setEntries((current) => current.map((row) => (row.host === host ? { ...row, token: state } : row)));
  }, []);

  return { entries, loading, addHost, removeHost, setToken, refresh };
}
