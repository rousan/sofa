/**
 * Everything the page says, kept apart from how it is laid out.
 *
 * Copy changes far more often than markup does, and keeping it here means a
 * wording change never involves reading JSX.
 */

/**
 * Where the extension lives.
 *
 * `store` is the Chrome Web Store listing. Until the listing is approved it is
 * null, and every call to action falls back to the repository, so the page
 * never offers a link that does not work.
 */
export const LINKS = {
  store: null as string | null,
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
  { term: 'Browser', detail: 'Chrome, or any Chromium browser that takes Manifest V3 extensions.' },
  { term: 'GitHub', detail: 'github.com out of the box. Private repositories included, using the session you already have.' },
  { term: 'Enterprise', detail: 'Click the toolbar icon, type your company GitHub hostname, accept the Chrome prompt. Once, per host.' },
  { term: 'Account', detail: 'None. No sign-in, no token to create, no OAuth app to authorise.' },
];

/**
 * What it does with your code, which is the question that matters.
 */
export const PRIVACY: SpecRow[] = [
  { term: 'On your machine', detail: 'Sofa reads the pages you already have open, with the session you are already signed in with.' },
  { term: 'No server', detail: 'There is nowhere to send anything. No backend, no analytics, no telemetry, no remote code.' },
  { term: 'Stored locally', detail: 'Only which files you marked viewed, in your own browser, per pull request.' },
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
  { keys: ['w'], action: 'Whole file or changes only' },
  { keys: ['v'], action: 'Mark the file viewed' },
  { keys: ['/'], action: 'Filter files' },
  { keys: ['esc'], action: 'Back to GitHub' },
];

/**
 * The commands for installing from source, shown while the listing is pending.
 */
export const INSTALL_COMMANDS = [
  'git clone https://github.com/rousan/sofa.git',
  'cd sofa && pnpm install && pnpm build',
];
