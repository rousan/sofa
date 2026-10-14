/**
 * Everything the page says, kept apart from how it is laid out.
 *
 * Copy changes far more often than markup does, and keeping it here means a
 * wording change never involves reading JSX.
 */

/**
 * Where the extension lives.
 *
 * `store` is the Chrome Web Store listing. Setting it to null falls every call
 * to action back to the repository, which is what the page did before the
 * listing was approved.
 */
export const LINKS = {
  store: 'https://chromewebstore.google.com/detail/sofa/pmjgcefgjbpbiikghomjoickjeibpnon' as string | null,
  repo: 'https://github.com/rousan/sofa',
  issues: 'https://github.com/rousan/sofa/issues',
  author: 'https://github.com/rousan',
};

/**
 * The one-line promise at the top of the page.
 */
export const HERO = {
  headline: 'Review pull requests at your comfort.',
  subhead:
    'GitHub gives you three lines around a change. Sofa gives you the file it lives in, '
    + 'in a tab of its own, next to Files changed.',
  price: 'Free',
};

/**
 * One line of a spec table: a term, and what it means.
 */
export interface SpecRow {
  /** The thing being described. */
  term: string;
  /** What it does, in a sentence. */
  detail: string;
}

/**
 * What the extension actually does, once installed.
 */
export const HOW_IT_WORKS: SpecRow[] = [
  {
    term: 'Side by side',
    detail: 'Base revision left, pull request right, each rewritten line opposite its replacement. One key switches to the unified column.',
  },
  {
    term: 'Whole files',
    detail: 'Fetches the file at the head commit and renders all of it, with the diff spliced in. One key toggles back to changes only.',
  },
  {
    term: 'File tree',
    detail: 'Collapsible directories, diff status, per-file counts, a filter, a draggable width, and viewed state that sticks.',
  },
  {
    term: 'A real tab',
    detail: 'Sits beside Files changed. Conversation, Commits and Checks keep working; closing it hands the page back to GitHub.',
  },
  {
    term: 'Comments in place',
    detail: 'Existing review comments appear under the line they were written against, threaded, with replies, rendered from Markdown.',
  },
  {
    term: 'Review from here',
    detail: 'Comment on a line, reply, hold comments back as a pending review, then approve or request changes. The same dialog GitHub gives you.',
  },
  {
    term: 'Instant',
    detail: 'Every file is fetched the moment the diff loads, so clicking one in the tree opens it in milliseconds.',
  },
  {
    term: 'Your theme',
    detail: "Built from GitHub's own colours, fonts and icons, so light, dark and dimmed all look right.",
  },
];

/**
 * What it needs to run.
 */
export const REQUIREMENTS: SpecRow[] = [
  { term: 'Browser', detail: 'Chrome, Edge, Brave, Arc or any other Chromium browser that loads Manifest V3 extensions, on macOS, Windows and Linux alike, with no separate build for any of them.' },
  { term: 'GitHub', detail: 'github.com out of the box, public and private repositories alike.' },
  { term: 'Enterprise', detail: 'Click the toolbar icon, type your company GitHub hostname, accept the Chrome prompt. Once, per host.' },
  { term: 'Token', detail: 'A fine-grained token with Contents: Read and Pull requests: Read and write, pasted into the popup once per host. Required, and it never leaves your browser.' },
];

/**
 * What it does with your code, which is the question that matters.
 */
export const PRIVACY: SpecRow[] = [
  { term: 'On your machine', detail: "Sofa calls GitHub's API directly from your browser, with your own token. Nothing passes through anyone else." },
  { term: 'No server', detail: 'There is nowhere to send anything. No backend, no analytics, no telemetry, no remote code.' },
  { term: 'Stored locally', detail: 'Your token and which files you marked viewed, in your own browser profile and nowhere else.' },
  { term: 'Open source', detail: 'Every line is on GitHub, including the build that produces the uploaded package.' },
];

/**
 * A keyboard shortcut and what it does.
 */
export interface Shortcut {
  /** The keys, already split into individual caps. */
  keys: string[];
  /** What pressing them does. */
  action: string;
}

/**
 * The keyboard reference.
 */
export const SHORTCUTS: Shortcut[] = [
  { keys: ['n', 'p'], action: 'Next or previous change' },
  { keys: [']', '['], action: 'Next or previous file' },
  { keys: ['s'], action: 'Side by side or unified' },
  { keys: ['w'], action: 'Whole file or changes only' },
  { keys: ['v'], action: 'Mark the file viewed' },
  { keys: ['/'], action: 'Filter files' },
  { keys: ['esc'], action: 'Back to GitHub' },
];
