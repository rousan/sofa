/**
 * The toolbar popup: manage the hosts Sofa is allowed to run on.
 *
 * `chrome.permissions.request` may only be called from an extension page in
 * response to a real user gesture, which is why adding a host lives here rather
 * than anywhere in the content script.
 */
import { grantedHosts, hostOf, toMatchPattern } from './permissions.ts';

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
    });

    const item = document.createElement('li');
    item.append(name, remove);
    list.appendChild(item);
  }
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
});

// Chrome can close the popup while its permission prompt is up, so the list is
// refreshed whenever the popup is shown again rather than only after a grant.
window.addEventListener('focus', () => void render());
void render();
