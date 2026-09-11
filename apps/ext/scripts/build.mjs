/**
 * Build the extension into `dist/`.
 *
 * Every entry is bundled separately, in IIFE form: a content script and a
 * service worker are plain scripts, not modules, and Rollup cannot emit several
 * IIFE bundles from one build because they cannot share chunks. Vite's
 * JavaScript API makes the repetition cheap.
 *
 * The static files are copied alongside, and the manifest is rewritten with its
 * paths made relative to `dist/`, so `dist/` alone is the unpacked extension.
 */
import { build } from 'vite';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * One IIFE bundle per entry point.
 *
 * `harness` is not part of the extension: it drives `test/harness.html`, which
 * renders the panel from a fixture with no network and no pull request.
 */
const ENTRIES = [
  { name: 'content', file: 'src/content.ts' },
  { name: 'background', file: 'src/background.ts' },
  { name: 'popup', file: 'src/popup.ts' },
  { name: 'fetch-bridge', file: 'src/fetch-bridge.ts' },
  { name: 'harness', file: 'test/harness.ts' },
];

/**
 * Files copied into the build output untouched.
 */
const ASSETS = [
  ['src/sofa.css', 'dist/sofa.css'],
  ['src/popup.html', 'dist/popup.html'],
  ['src/icons/icon-16.png', 'dist/icons/icon-16.png'],
  ['src/icons/icon-32.png', 'dist/icons/icon-32.png'],
  ['src/icons/icon-48.png', 'dist/icons/icon-48.png'],
  ['src/icons/icon-128.png', 'dist/icons/icon-128.png'],
];

/**
 * Copy the static assets and write the manifest Chrome loads.
 *
 * @returns {Promise<void>} Resolves once every file is in place.
 */
async function copyAssets() {
  await mkdir(resolve(root, 'dist/icons'), { recursive: true });
  for (const [from, to] of ASSETS) {
    await copyFile(resolve(root, from), resolve(root, to));
  }

  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  const strip = (file) => file.replace(/^dist\//, '');
  for (const script of manifest.content_scripts ?? []) {
    script.js = (script.js ?? []).map(strip);
    script.css = (script.css ?? []).map(strip);
  }
  if (manifest.background?.service_worker) {
    manifest.background.service_worker = strip(manifest.background.service_worker);
  }
  if (manifest.action?.default_popup) {
    manifest.action.default_popup = strip(manifest.action.default_popup);
  }
  const stripIcons = (icons) =>
    Object.fromEntries(Object.entries(icons ?? {}).map(([size, file]) => [size, strip(file)]));
  if (manifest.icons) manifest.icons = stripIcons(manifest.icons);
  if (manifest.action?.default_icon) manifest.action.default_icon = stripIcons(manifest.action.default_icon);

  await writeFile(resolve(root, 'dist/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Bundle one entry point as a standalone IIFE.
 *
 * @param {{name: string, file: string}} entry - What to build and what to call it.
 * @param {boolean} watch - Whether to keep rebuilding on change.
 * @returns {Promise<void>} Resolves when the build finishes, or once watching starts.
 */
async function bundle(entry, watch) {
  await build({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    build: {
      watch: watch ? {} : null,
      lib: {
        entry: resolve(root, entry.file),
        formats: ['iife'],
        name: `sofa_${entry.name.replace(/-/g, '_')}`,
        fileName: () => `${entry.name}.js`,
      },
    },
    logLevel: 'warn',
  });
}

const watch = process.argv.includes('--watch');
await copyAssets();
for (const entry of ENTRIES) {
  await bundle(entry, watch);
}
console.log(watch ? 'watching for changes' : `built ${ENTRIES.length} bundles into dist/`);
