/**
 * Generate a throwaway static site that looks enough like a GitHub pull request
 * for the real content script to run against it.
 *
 * This exists because the risky half of the extension is the half that touches
 * GitHub's own DOM: injecting the tab into the tab bar and standing in for the
 * tab's content. `test/harness.html` cannot cover that, since it renders the
 * panel directly. Serving this tree at the server root gives the unmodified
 * bundle a pull request URL, a tab bar, a `.diff` endpoint and `/raw/` files.
 */
import { mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { diffText, headFileTexts } from '../test/fixture.ts';

/**
 * Where the fake site is written. Served as the web root, never committed.
 */
const OUT = 'test/fake';

/**
 * Coordinates of the fake pull request, mirroring the fixture's own.
 */
const OWNER = 'acme';
const REPO = 'webapp';
const NUMBER = 42;
const SHA = 'f'.repeat(40);

/**
 * Write one file, creating its directories first.
 *
 * @param {string} path - Path to write, relative to the process cwd.
 * @param {string} body - File contents.
 * @returns {Promise<void>} Resolves once written.
 */
async function put(path, body) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

/**
 * The tab bar and page chrome GitHub renders around a pull request's content.
 *
 * The shapes that matter to the content script are reproduced: the tabs are
 * anchors inside `nav.tabnav-tabs`, one of them carries the selected class and
 * `aria-current`, the head sha is in an embedded JSON payload, and the content
 * below the nav sits in sibling elements that Sofa has to hide.
 *
 * @returns {string} The page's HTML.
 */
function page() {
  const tab = (name, href, count, selected) =>
    `<a class="tabnav-tab${selected ? ' selected' : ''}" href="${href}"${selected ? ' aria-current="page"' : ''}>`
    + `${name}${count ? ` <span class="Counter">${count}</span>` : ''}</a>`;

  const base = `/${OWNER}/${REPO}/pull/${NUMBER}`;
  return `<!doctype html>
<html lang="en" data-color-mode="light">
<head>
  <meta charset="utf-8" />
  <title>Normalise chart settings props #${NUMBER}</title>
  <link rel="stylesheet" href="/dist/sofa.css" />
  <style>
    body { margin: 0; font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; }
    .page { max-width: 1280px; margin: 0 auto; padding: 0 16px; }
    h1 { font-size: 32px; font-weight: 400; margin: 24px 0 8px; }
    .tabnav-tabs { display: flex; gap: 8px; border-bottom: 1px solid #d0d7de; margin-top: 16px; }
    .tabnav-tab { padding: 8px 16px; text-decoration: none; color: #1f2328; font-size: 14px;
      border: 1px solid transparent; border-radius: 6px 6px 0 0; margin-bottom: -1px; }
    .tabnav-tab.selected { background: #fff; border-color: #d0d7de; border-bottom-color: #fff; font-weight: 600; }
    .Counter { background: #eaeef2; border-radius: 10px; padding: 0 6px; font-size: 12px; }
    .pr-toolbar, .diff-view { border: 1px solid #d0d7de; border-radius: 6px; margin-top: 16px; padding: 16px; color: #636c76; }
  </style>
</head>
<body>
  <script type="application/json">{"headRefOid":"${SHA}"}</script>
  <div class="page">
    <h1>Normalise chart settings props <span>#${NUMBER}</span></h1>
    <nav class="tabnav-tabs" aria-label="Pull request tabs">
      ${tab('Conversation', `${base}`, 82, false)}
      ${tab('Commits', `${base}/commits`, 32, false)}
      ${tab('Checks', `${base}/checks`, 11, false)}
      ${tab('Files changed', `${base}/files`, 5, true)}
    </nav>
    <div class="pr-toolbar">GitHub's own diff toolbar. Sofa hides this while it is open.</div>
    <div class="diff-view">GitHub's own diff. Sofa hides this while it is open.</div>
  </div>
  <!-- The extension's own bundle, loaded as a page script so the fake forge can
       be driven in a plain browser with no extension installed. -->
  <script src="/dist/content.js"></script>
</body>
</html>
`;
}

await rm(OUT, { recursive: true, force: true });
await put(join(OUT, OWNER, REPO, 'pull', `${NUMBER}.diff`), diffText);
await put(join(OUT, OWNER, REPO, 'pull', String(NUMBER), 'files', 'index.html'), page());
await put(join(OUT, OWNER, REPO, 'pull', String(NUMBER), 'index.html'), page());
for (const [path, body] of Object.entries(headFileTexts)) {
  await put(join(OUT, OWNER, REPO, 'raw', SHA, path), body);
}
// The page loads the built bundle from /dist, so link it into the web root.
await symlink(relative(OUT, 'dist'), join(OUT, 'dist'), 'dir');

console.log(`fake forge written to ${OUT}`);
console.log(`serve it with:  python3 -m http.server 3054 --directory apps/ext/${OUT}`);
console.log(`then open:      http://127.0.0.1:3054/${OWNER}/${REPO}/pull/${NUMBER}/files/`);
