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
  eyebrow: 'Chrome extension for code review',
  headline: 'Review pull requests at your comfort',
  subhead:
    'GitHub shows you three lines around a change. Sofa shows you the file. A tab next to '
    + 'Files changed, a real file tree, and every diff read in context.',
  trust: ['Free and open source', 'No account', 'Nothing leaves your browser'],
};

/**
 * A capability shown in the feature grid.
 */
export interface Feature {
  /** Short heading. */
  title: string;
  /** One or two sentences of detail. */
  body: string;
  /** Which glyph to draw beside it. */
  icon: 'file' | 'tree' | 'palette' | 'keyboard' | 'bolt' | 'building';
}

/**
 * The feature grid.
 */
export const FEATURES: Feature[] = [
  {
    icon: 'file',
    title: 'Whole files, not hunks',
    body: 'Every line of the file, with added and removed lines in place. One key toggles back to changes only.',
  },
  {
    icon: 'tree',
    title: 'A file tree that works',
    body: 'Collapsible directories, diff status, per-file counts, a filter, a draggable width, and viewed state that sticks.',
  },
  {
    icon: 'palette',
    title: 'Looks like GitHub',
    body: "Built from GitHub's own colours, fonts and icons, so light, dark and dimmed all just work.",
  },
  {
    icon: 'keyboard',
    title: 'Keyboard first',
    body: 'Move between changes and files without touching the mouse. Mark a file viewed and move on.',
  },
  {
    icon: 'bolt',
    title: 'Opens instantly',
    body: 'Every file is fetched the moment the diff loads, so clicking one in the tree opens it in milliseconds.',
  },
  {
    icon: 'building',
    title: 'Works at work',
    body: 'GitHub Enterprise too. Add your company host from the toolbar popup; nothing about it is baked in.',
  },
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
 * A question worth answering before someone installs.
 */
export interface Question {
  /** The question, as a reader would ask it. */
  question: string;
  /** The answer, in a sentence or two. */
  answer: string;
}

/**
 * The questions people ask before installing a review tool.
 */
export const FAQ: Question[] = [
  {
    question: 'Does my code go anywhere?',
    answer:
      'No. Sofa reads the pages you already have open, using the session you are already signed in with. '
      + 'There is no server, no analytics and no telemetry. The only thing it stores is which files you '
      + 'marked viewed, in your own browser.',
  },
  {
    question: 'Does it work on private repositories?',
    answer:
      'Yes. It uses your existing GitHub session, so anything you can see in the browser, Sofa can render. '
      + 'No token to create, no OAuth app to authorise.',
  },
  {
    question: 'Does it work on GitHub Enterprise?',
    answer:
      'Yes. Click the Sofa icon in the toolbar, type your company GitHub hostname, and accept the Chrome '
      + 'prompt. That grant lives in your browser; the hostname is never part of the extension.',
  },
  {
    question: 'Does it replace the Files changed tab?',
    answer:
      'No. Sofa is its own tab beside it. Conversation, Commits and Checks keep working exactly as before, '
      + 'and closing Sofa hands the page straight back to GitHub.',
  },
  {
    question: 'Can I still comment on a pull request?',
    answer:
      'Comment and approve on GitHub’s own tab, which is one click away. Sofa is for reading the change; '
      + 'it deliberately does not reimplement review actions.',
  },
];

/**
 * The commands for installing from source, shown while the listing is pending.
 */
export const INSTALL_COMMANDS = [
  'git clone https://github.com/rousan/sofa.git',
  'cd sofa && pnpm install && pnpm build',
];
