/**
 * Everything the page says, kept apart from how it is laid out.
 *
 * The copy is the part most likely to change, and having it in one place means
 * a wording change never involves reading the markup.
 */

/**
 * A capability shown in the feature grid.
 */
export interface Feature {
  /** Short heading. */
  title: string;
  /** One or two sentences of detail. */
  body: string;
}

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
 * Where the extension can be had, linked from the hero.
 */
export const LINKS = {
  repo: 'https://github.com/rousan/sofa',
  install: 'https://github.com/rousan/sofa#install',
  author: 'https://github.com/rousan',
  /** Set once the Chrome Web Store listing is approved. */
  store: null as string | null,
};

/**
 * The feature grid.
 */
export const FEATURES: Feature[] = [
  {
    title: 'Whole files',
    body: 'Every line of the file, with the diff spliced into it. Toggle back to changes-only when you do not need it.',
  },
  {
    title: 'A real file tree',
    body: 'Collapsible directories, status icons, per-file counts, a filter, a draggable width, and viewed state that sticks.',
  },
  {
    title: 'Native to the page',
    body: "A tab beside Files changed, using GitHub's own colours, fonts and icons. Your theme is its theme.",
  },
  {
    title: 'Keyboard first',
    body: 'Jump between changes and between files without reaching for the mouse.',
  },
  {
    title: 'Instant',
    body: 'Every file is fetched in the background as soon as the diff loads, so clicking one opens it immediately.',
  },
  {
    title: 'Enterprise too',
    body: "Add your company's GitHub host from the toolbar popup. Nothing about it is baked into the extension.",
  },
];

/**
 * The keyboard reference.
 */
export const SHORTCUTS: Shortcut[] = [
  { keys: ['n', 'p'], action: 'Next or previous change in the file' },
  { keys: [']', '['], action: 'Next or previous file' },
  { keys: ['w'], action: 'Whole file or changes only' },
  { keys: ['v'], action: 'Mark the file viewed' },
  { keys: ['/'], action: 'Filter files' },
  { keys: ['esc'], action: 'Back to GitHub' },
];

/**
 * The install commands, shown before the store listing is live.
 */
export const INSTALL_COMMANDS = [
  'git clone https://github.com/rousan/sofa.git',
  'cd sofa',
  'pnpm install',
  'pnpm build',
];
