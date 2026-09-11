/**
 * Render src/icon.svg into the PNG sizes Chrome and the Web Store need.
 *
 * Only needed when the artwork changes; the PNGs are committed, so a normal
 * build never runs this. It drives a headless Chrome because that is the one
 * renderer guaranteed to agree with how the icon will actually look in the
 * browser, and it avoids adding an image dependency for a once-a-year job.
 *
 * Usage: node scripts/make-icons.mjs   (set CHROME_BIN to pick the binary)
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);

/**
 * The icon sizes to produce: Chrome's toolbar and extensions page use the first
 * three, the Web Store listing uses 128.
 */
const SIZES = [16, 32, 48, 128];

/**
 * Locate a Chrome or Chromium binary to render with.
 *
 * @returns {Promise<string>} Path to the binary.
 * @throws When no binary can be found.
 */
async function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const patterns = [
    `${process.env.HOME}/.cache/puppeteer/chrome/*/chrome-mac*/*.app/Contents/MacOS/Google Chrome for Testing`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const pattern of patterns) {
    for await (const match of glob(pattern)) return match;
  }
  throw new Error('no Chrome found; set CHROME_BIN');
}

const chrome = await findChrome();
const svg = resolve('src/icon.svg');
await mkdir('src/icons', { recursive: true });

for (const size of SIZES) {
  // A page holding just the SVG at the target size, screenshotted on a
  // transparent background at exactly that many device pixels.
  const page = resolve(tmpdir(), `sofa-icon-${size}.html`);
  await writeFile(page, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head>`
    + `<body><img src="file://${svg}" width="${size}" height="${size}"></body></html>`);
  await run(chrome, [
    '--headless',
    '--disable-gpu',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    '--hide-scrollbars',
    `--window-size=${size},${size}`,
    `--screenshot=src/icons/icon-${size}.png`,
    `file://${page}`,
  ]);
  await rm(page, { force: true });
  console.log(`src/icons/icon-${size}.png`);
}
