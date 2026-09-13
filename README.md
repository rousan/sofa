# sofa

Agentic PR reviews at your comfort. [sofa.rousanali.com](https://sofa.rousanali.com)
· [Chrome Web Store](https://chromewebstore.google.com/detail/sofa/pmjgcefgjbpbiikghomjoickjeibpnon)

Sofa is a Chrome extension that adds a **Sofa** tab next to *Files changed* on any
GitHub pull request and reviews it the way an editor would: file tree on the left,
one file at a time on the right, and each file shown **in full** with its diff
spliced in — not as a set of disconnected hunks.

## Why

GitHub's diff shows three lines of context around a change. When the change sits
inside a long function, that is not enough to judge it, and *Expand up* / *Expand
down* is slow, fiddly, and sometimes simply does not load. Sofa fetches the whole
file at the pull request's head commit and renders every line of it, with added
lines highlighted and removed lines interleaved where they used to be.

## Install

[**Add Sofa to Chrome**](https://chromewebstore.google.com/detail/sofa/pmjgcefgjbpbiikghomjoickjeibpnon)
— free, on the Chrome Web Store. Then open any pull request and click the
**Sofa** tab.

To run your own build instead:

```bash
pnpm install
pnpm build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → pick the **`apps/ext/dist/`** folder (the build writes a
self-contained manifest there).

`pnpm --filter @sofa/ext watch` rebuilds on change; hit the reload icon on the extension card and
refresh the pull request to pick a rebuild up.

### Adding a GitHub Enterprise host

Sofa ships with permission for `github.com` only. To review pull requests on a
company forge, click the Sofa toolbar icon, type the hostname, and accept
Chrome's permission prompt. The service worker registers the content script for
that host on the spot and re-registers it on every browser start, so it is a
one-off. Remove a host from the same popup to revoke it.

Nothing about your forge is stored in the repository or the build: the grant
lives in your own browser profile.

### If your Chrome is managed

A managed Chrome may refuse with *"Extension installation is blocked by policy"*.
That policy is attached to the Google Chrome bundle, so an unmanaged Chrome for
Testing (or plain Chromium) build loads the extension fine:

```bash
npx @puppeteer/browsers install chrome@stable
"$HOME/.cache/puppeteer/chrome/"*/chrome-mac*/Google*/Contents/MacOS/Google* \
  --user-data-dir="$HOME/.local/share/dev-chrome" --no-first-run
```

Then load `dist/` from `chrome://extensions` in that window: Developer mode works
there, and both the extension and your logins persist in that profile.

The other route is to ask IT to allowlist the extension id, which needs a pinned
`key` in `manifest.json`.

## What it does

- **Behaves like a native tab**: the panel renders where GitHub's own diff would,
  so the header, tab bar and navigation stay put and Conversation / Commits /
  Checks are one click away. The tab takes GitHub's selected styling while it is
  open and hands it straight back on close. Nothing of GitHub's is removed, only
  hidden.
- **File tree** with status letters (A/D/R/M), per-file `+`/`-` counts, a filter
  box, single-child directory collapsing, and a draggable width.
- **Whole-file diffs**: both old and new line-number gutters stay correct across
  the whole file, not just inside hunks.
- **Page-flow layout**: the code runs down the page as one long file, with the
  file tree and the file header stuck to the viewport beside and above it, so
  there is no panel-inside-a-panel scrolling.
- **Changes only** toggle for when the full file is not wanted, applied
  automatically to files over 40,000 rows so a generated file cannot freeze the tab.
- **GitHub's own iconography**: Octicon folder, file and diff-status glyphs in the
  tree, at GitHub's sizes and colours.
- **Syntax highlighting** for the common languages. Every colour and font comes
  from GitHub's own Primer CSS variables, so light, dark, dimmed and high-contrast
  themes are followed with no theme code of Sofa's own.
- **Viewed** checkboxes, remembered per pull request.
- Added, deleted, renamed and binary files all handled; a file whose full text
  cannot be fetched falls back to plain hunks with a note saying so.

### Keyboard

| key | action |
| --- | --- |
| `n` / `p` | next / previous change in the file |
| `]` / `[` (or `j` / `k`) | next / previous file |
| `w` | toggle whole file vs changes only |
| `v` | mark the current file viewed |
| `/` | focus the file filter |
| `esc` | close the panel |

## How it works

No API token and no OAuth app: every request is a same-origin request that reuses
the browser session you are already logged in with, so private repositories and
GitHub Enterprise work unchanged.

1. `<pull-request>.diff` gives the whole pull request as one unified diff.
   Fetching it takes three routes, because none works everywhere: the service
   worker (the only one with a CORS exemption, which github.com needs since its
   `.diff` redirects to another host), a script in the page's own world (for
   Enterprise, whose media path answers 403 to anything attributed to an
   extension), and a plain fetch for the offline harness.
2. The head commit sha comes from the JSON the page embeds, or a blob link on the
   page, or the last commit in `<pull-request>.patch`.
3. `/raw/<sha>/<path>` gives each file's full text, fetched lazily per file.
4. `src/model.ts` walks the head file and splices the hunks in, verifying the
   hunks' context lines against the file. If they do not match, the sha was
   wrong, so Sofa confirms the head commit against the pull request's own
   `.patch` and retries once before falling back to a plain hunk view.

## Supported hosts

`manifest.json` grants `github.com` at install time and declares `*://*/*` as an
*optional* host permission, which grants nothing by itself. Everything else is
requested at runtime from the popup, so a private hostname never appears in the
repository or in a published listing.

## Packaging

`npm run package` writes `sofa-<version>.zip` from `dist/`, which is the shape
the Chrome Web Store wants (manifest at the zip root, no source maps, no test
harness). Before a first submission you still need icons: a 128x128 for the
listing and 16/32/48/128 referenced from an `icons` block in `manifest.json`,
plus at least one 1280x800 screenshot.

## Layout

A pnpm workspace: two apps and the package they share.

```
packages/core/         the forge-agnostic half: diff parser, model, highlighter
  src/diff.ts          unified diff parser
  src/model.ts         splices hunks into the full file
  src/highlight.ts     small dependency-free syntax highlighter
  src/types.ts         the shapes everything passes around
  test/                parser and merge tests (node --test)

apps/ext/              the Chrome extension
  manifest.json        paths are rewritten into dist/ at build time
  scripts/build.mjs    Vite, once per entry, because each bundle is an IIFE
  src/content.ts       injects the Sofa tab, tracks SPA navigation
  src/background.ts    service worker: script registration and the fetch relay
  src/fetch-bridge.ts  page-world fetch relay, for forges that refuse extensions
  src/popup.ts/.html   add or remove Enterprise hosts
  src/github.ts        all forge fetches and head-sha resolution
  src/ui/              the panel, the file tree, the file viewer
  src/sofa.css         styling, driven by GitHub's Primer variables
  store/               Chrome Web Store listing copy and screenshot
  test/harness.html    renders the panel from a fixture, no network needed

apps/landing/          the site at sofa.rousanali.com (React, Vite, Tailwind)
```

## Development

```bash
pnpm typecheck                      # tsc across the workspace
pnpm test                           # node --test, native TypeScript
pnpm build                          # every package
pnpm check                          # all three
pnpm dev                            # the landing page, with hot reload
pnpm package                        # zip the extension for the Web Store
```

Two offline ways to work on the extension without a real pull request:

```bash
pnpm --filter @sofa/ext build && python3 -m http.server 8080
pnpm --filter @sofa/ext fake  && python3 -m http.server 8080 --directory apps/ext/test/fake
```

The first serves `apps/ext/test/harness.html`, which renders the panel straight
from a fixture. The second builds a throwaway static site shaped like a pull
request - tab bar, `.diff` endpoint, `/raw/` files - and loads the real content
script against it, which is the only way to exercise the tab injection and the
content takeover without a forge.
