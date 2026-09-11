/**
 * Build driver for the Sofa extension.
 *
 * Chrome cannot load TypeScript, so esbuild bundles each entry point into a
 * plain script and the static files are copied beside them. Everything lands in
 * `dist/`, which is then a complete unpacked extension on its own. `--watch`
 * keeps rebuilding, which is what `npm run watch` uses.
 */
import { context, build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

/**
 * Shared esbuild options for every entry point.
 *
 * `iife` matters: neither a content script nor a service worker is a module, so
 * the bundle must execute on load with no import statements left in it.
 */
const shared = {
  bundle: true,
  format: 'iife',
  target: ['chrome110'],
  platform: 'browser',
  logLevel: 'info',
  sourcemap: true,
};

/**
 * The entry points: the content script injected into pull request pages, the
 * service worker that keeps runtime-granted hosts registered, the popup that
 * grants them, and the offline harness used by `test/harness.html`.
 */
const entries = [
  { entryPoints: ['src/content.ts'], outfile: 'dist/content.js' },
  { entryPoints: ['src/fetch-bridge.ts'], outfile: 'dist/fetch-bridge.js' },
  { entryPoints: ['src/background.ts'], outfile: 'dist/background.js' },
  { entryPoints: ['src/popup.ts'], outfile: 'dist/popup.js' },
  { entryPoints: ['test/harness.ts'], outfile: 'dist/harness.js' },
];

/**
 * Static files copied verbatim into the build output.
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
 * Every path in the manifest is rewritten relative to `dist/`, so the build
 * output is self-contained and no source or `node_modules` reaches the browser.
 *
 * @returns {Promise<void>} Resolves once every file is in place.
 */
async function copyAssets() {
  await mkdir('dist/icons', { recursive: true });
  for (const [from, to] of ASSETS) {
    await copyFile(from, to);
  }

  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
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
  const stripIcons = (icons) => Object.fromEntries(Object.entries(icons ?? {}).map(([size, file]) => [size, strip(file)]));
  if (manifest.icons) manifest.icons = stripIcons(manifest.icons);
  if (manifest.action?.default_icon) manifest.action.default_icon = stripIcons(manifest.action.default_icon);
  await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
}

await copyAssets();

if (process.argv.includes('--watch')) {
  for (const entry of entries) {
    const ctx = await context({ ...shared, ...entry });
    await ctx.watch();
  }
  console.log('watching for changes');
} else {
  await Promise.all(entries.map((entry) => build({ ...shared, ...entry })));
}
