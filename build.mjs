/**
 * Build driver for the Sofa extension.
 *
 * Chrome cannot load TypeScript, so esbuild bundles the two entry points into
 * plain IIFE scripts and the stylesheet is copied beside them. `--watch` keeps
 * rebuilding, which is what `npm run watch` uses during development.
 */
import { context, build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

/**
 * Optional untracked file listing extra hosts to run on, as Chrome match
 * patterns, e.g. `["*://ghe.example.com/*"]`.
 *
 * A private GitHub Enterprise hostname does not belong in a public repository,
 * so the committed manifest lists only github.com and any private forge is
 * added here, locally.
 */
const LOCAL_HOSTS = 'hosts.local.json';

/**
 * Read the local host overrides, if the file exists.
 *
 * @returns {Promise<string[]>} Match patterns to add, empty when there is no file.
 */
async function localHosts() {
  try {
    const parsed = JSON.parse(await readFile(LOCAL_HOSTS, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Shared esbuild options for every entry point.
 *
 * `iife` matters: a Chrome content script is not a module, so the bundle must
 * execute on load with no import statements left in it.
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
 * Write everything Chrome loads into `dist/`.
 *
 * The stylesheet is copied and the manifest is rewritten with its paths made
 * relative to `dist/`, so `dist/` alone is the complete unpacked extension and
 * no source or `node_modules` is handed to the browser.
 *
 * @returns {Promise<void>} Resolves once both files are in place.
 */
async function copyAssets() {
  await mkdir('dist', { recursive: true });
  await copyFile('src/sofa.css', 'dist/sofa.css');

  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  const extra = await localHosts();
  if (extra.length) {
    manifest.host_permissions = [...new Set([...(manifest.host_permissions ?? []), ...extra])];
  }
  for (const script of manifest.content_scripts ?? []) {
    script.js = (script.js ?? []).map((file) => file.replace(/^dist\//, ''));
    script.css = (script.css ?? []).map((file) => file.replace(/^dist\//, ''));
    if (extra.length) script.matches = [...new Set([...(script.matches ?? []), ...extra])];
  }
  await writeFile('dist/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  if (extra.length) console.log(`added ${extra.length} host(s) from ${LOCAL_HOSTS}`);
}

/**
 * The entry points: the content script Chrome loads, and the offline harness
 * used by `test/harness.html` to render the panel without a pull request.
 */
const entries = [
  { entryPoints: ['src/content.ts'], outfile: 'dist/content.js' },
  { entryPoints: ['test/harness.ts'], outfile: 'dist/harness.js' },
];

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
