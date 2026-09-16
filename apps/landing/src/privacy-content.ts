/**
 * The privacy policy, as data.
 *
 * It is kept apart from the markup for the same reason the rest of the copy is:
 * this is the text that has to be right, and it should be readable without
 * JSX around it. It describes the extension and this website separately,
 * because they are different pieces of software with different exposure.
 */

/**
 * A section of the policy.
 */
export interface PolicySection {
  /** The heading. */
  title: string;
  /** One or more paragraphs. */
  paragraphs: string[];
  /** An optional list of specifics under the paragraphs. */
  points?: string[];
}

/**
 * When this version of the policy took effect.
 */
export const EFFECTIVE_DATE = '13 September 2026';

/**
 * The policy itself.
 */
export const POLICY: PolicySection[] = [
  {
    title: 'The short version',
    paragraphs: [
      'Sofa collects nothing. It has no server, no analytics, no telemetry and no account. '
      + 'Nothing you look at with it is sent anywhere, because there is nowhere for it to be sent.',
    ],
  },
  {
    title: 'What the extension can see',
    paragraphs: [
      'Sofa runs on pull request pages, on github.com and on any GitHub Enterprise host you add '
      + 'yourself. On those pages it reads the page you already have open, and it asks the same '
      + 'server for two more things using the session you are already signed in with: the pull '
      + 'request’s diff, and the text of each changed file at the commit under review.',
      'Those requests go to your forge and nowhere else. The results are rendered in the tab and '
      + 'held in memory until you close it.',
    ],
  },
  {
    title: 'What the extension stores',
    paragraphs: ['Two things, both in your own browser, neither leaving it:'],
    points: [
      'Which files you have marked as viewed, per pull request, in the browser’s local storage.',
      'The width you dragged the file tree to.',
      'The hosts you have granted, which Chrome itself stores as extension permissions.',
      'A forge API token, if you chose to add one, in the extension’s storage.',
    ],
  },
  {
    title: 'The token',
    paragraphs: [
      'Sofa reads three things through the forge’s API: the pull request’s diff, the text of each '
      + 'changed file, and the review comments already on it. The API takes a token rather than the '
      + 'browser session, which is why you are asked for one. It is the reliable route; where it is '
      + 'absent, Sofa falls back to reading the pages your session can already see.',
      'A token you add in the extension’s popup is stored in the extension’s own storage, scoped to '
      + 'the host you entered it for. It is sent to that forge’s API and nowhere else, as the '
      + 'Authorization header. It is never exposed to the page, never logged, and never leaves your '
      + 'browser in any other direction. Clearing the field removes it.',
      'The permissions it needs are the smallest that work: Pull requests: Read, and Contents: Read '
      + 'for the file bodies. A public repository needs no token at all.',
    ],
  },
  {
    title: 'What the extension does not do',
    paragraphs: ['To be explicit about the things an extension with this kind of access could do:'],
    points: [
      'It does not collect or transmit personal information, credentials, or the contents of the code you review.',
      'It does not track your browsing, your history, or the pages you visit.',
      'It does not contain analytics, advertising, or third-party scripts.',
      'It does not load remote code: everything it runs is in the package you installed.',
      'It does not sell or share data with anyone, because it holds none to sell.',
    ],
  },
  {
    title: 'Permissions, and why each one exists',
    paragraphs: ['Chrome shows these at install; this is what each is for.'],
    points: [
      'github.com, raw.githubusercontent.com and patch-diff.githubusercontent.com: the pages Sofa runs on, and the two hosts GitHub redirects diffs and file contents to.',
      'api.github.com: where the diff, the file contents and the review comments are read from when you have added a token.',
      'storage: to keep your token and your host grants, in the extension rather than in the page.',
      'Optional access to a site you name: so you can point Sofa at your own GitHub Enterprise server. Nothing is granted until you type a hostname and accept Chrome’s prompt, and you can revoke it from the same popup.',
      'scripting: to register Sofa on a host you added after installing, which cannot be listed in the package.',
    ],
  },
  {
    title: 'This website',
    paragraphs: [
      'sofa.rousanali.com is a static site on GitHub Pages. It sets no cookies and runs no analytics. '
      + 'Two things are worth naming anyway: GitHub keeps its own server logs, which include visitor IP '
      + 'addresses, and the page loads the JetBrains Mono typeface from Google Fonts, which means Google '
      + 'sees a request from your browser when you open it.',
    ],
  },
  {
    title: 'Changes',
    paragraphs: [
      'If this policy changes, the new version appears here with a new effective date, and the change '
      + 'is in the repository’s history like everything else.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [
      'Questions, or something here that does not match what you observe: open an issue on the '
      + 'repository. Sofa is maintained by one person, in the open.',
    ],
  },
];
