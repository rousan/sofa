/**
 * The toolbar popup: manage the hosts Sofa is allowed to run on.
 *
 * `chrome.permissions.request` may only be called from an extension page in
 * response to a real user gesture, which is why adding a host lives here rather
 * than anywhere in the content script.
 */
import { grantedHosts, hostOf, toMatchPattern } from './permissions.ts';
import { loadTokens, saveToken } from './tokens.ts';

const form = document.getElementById('add-form') as HTMLFormElement;
const input = document.getElementById('host-input') as HTMLInputElement;
const list = document.getElementById('host-list') as HTMLUListElement;
const error = document.getElementById('error') as HTMLDivElement;

/**
 * Show a message under the form, or clear it.
 *
 * @param message - Text to show; an empty string hides the line.
 */
function setError(message: string): void {
  error.textContent = message;
  error.hidden = !message;
}

/**
 * Draw the token field for one host.
 *
 * A token is what lets Sofa show review comments: the forge serves those from
 * its API, which takes a token rather than the browser session. It is optional,
 * and the diff works without one.
 *
 * @param host - The forge hostname the token belongs to.
 * @param current - The token already stored for that host, if any.
 * @returns The row element.
 */
function tokenRow(host: string, current: string | undefined): HTMLLIElement {
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = current ? 'saved' : 'token for review comments';
  input.value = current ?? '';
  input.setAttribute('aria-label', `GitHub token for ${host}`);

  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'Save';
  save.addEventListener('click', async () => {
    await saveToken(host, input.value);
    save.textContent = input.value.trim() ? 'Saved' : 'Cleared';
    setTimeout(() => { save.textContent = 'Save'; }, 1200);
  });

  const label = document.createElement('span');
  label.className = 'host';
  label.textContent = host;

  const item = document.createElement('li');
  item.className = 'token-row';
  item.append(label, input, save);
  return item;
}

/**
 * Redraw the list of hosts the user has added.
 */
async function render(): Promise<void> {
  const hosts = await grantedHosts();
  list.textContent = '';

  if (!hosts.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No extra hosts yet.';
    list.appendChild(empty);
    return;
  }

  for (const origin of hosts) {
    const name = document.createElement('span');
    name.className = 'host';
    name.textContent = hostOf(origin);

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      await chrome.permissions.remove({ origins: [origin] });
      await render();
      await renderTokens();
    });

    const item = document.createElement('li');
    item.append(name, remove);
    list.appendChild(item);
  }
}

/**
 * Redraw the token fields: github.com always, plus every granted host.
 */
async function renderTokens(): Promise<void> {
  const list = document.getElementById('token-list');
  if (!list) return;
  const [hosts, tokens] = await Promise.all([grantedHosts(), loadTokens()]);
  const all = ['github.com', ...hosts.map(hostOf)];
  list.textContent = '';
  for (const host of all) list.appendChild(tokenRow(host, tokens[host]));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError('');

  const pattern = toMatchPattern(input.value);
  if (!pattern) {
    setError('That does not look like a hostname.');
    return;
  }

  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) {
    setError('Permission was not granted.');
    return;
  }

  input.value = '';
  await render();
  await renderTokens();
});

// Chrome can close the popup while its permission prompt is up, so the list is
// refreshed whenever the popup is shown again rather than only after a grant.
window.addEventListener('focus', () => {
  void render();
  void renderTokens();
});
void render();
void renderTokens();
