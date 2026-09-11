/**
 * Page-world fetch bridge.
 *
 * A content script's own `fetch` is attributed to the extension, not to the
 * page. Most of the time that is invisible, but GitHub Enterprise redirects
 * `.diff`, `.patch` and raw file URLs to a media path that refuses requests
 * which did not come from the page itself, answering 403 where the very same
 * URL returns 200 in the page's console.
 *
 * This script runs in the page's main world, so the fetches it makes are
 * indistinguishable from the page's own. The isolated-world side of Sofa asks
 * for a URL over `postMessage` and gets the body back the same way.
 *
 * It will only fetch same-origin URLs. Any script on the page could already
 * fetch those for itself, so the bridge hands out no capability the page did
 * not already have.
 */

/**
 * Message name for a request coming from the isolated world.
 */
const REQUEST = 'sofa:fetch-request';

/**
 * Message name for the reply this bridge posts back.
 */
const RESPONSE = 'sofa:fetch-response';

/**
 * The shape the isolated world posts.
 */
interface BridgeRequest {
  /** Discriminator identifying a Sofa request. */
  kind: typeof REQUEST;
  /** Correlates the reply with its request. */
  id: string;
  /** Absolute URL to fetch; refused unless it is same-origin. */
  url: string;
}

/**
 * Attribute announcing that the bridge is listening.
 *
 * The DOM is the one thing both worlds can see, so this is how the isolated
 * world knows whether asking is worthwhile; without it, every request would
 * wait out a timeout in any context that has no bridge, such as the offline
 * harness.
 */
document.documentElement.setAttribute('data-sofa-bridge', '1');

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as BridgeRequest | undefined;
  if (!data || data.kind !== REQUEST || typeof data.url !== 'string') return;

  const reply = (payload: Record<string, unknown>): void => {
    window.postMessage({ kind: RESPONSE, id: data.id, ...payload }, window.location.origin);
  };

  let url: URL;
  try {
    url = new URL(data.url, window.location.href);
  } catch {
    reply({ ok: false, status: 0, statusText: 'bad url', text: '' });
    return;
  }
  if (url.origin !== window.location.origin) {
    reply({ ok: false, status: 0, statusText: 'cross-origin', text: '' });
    return;
  }

  void fetch(url.href, { credentials: 'same-origin', headers: { Accept: 'text/plain, */*' } })
    .then(async (response) => {
      reply({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text: response.ok ? await response.text() : '',
      });
    })
    .catch((err: unknown) => {
      reply({ ok: false, status: 0, statusText: err instanceof Error ? err.message : 'failed', text: '' });
    });
});
