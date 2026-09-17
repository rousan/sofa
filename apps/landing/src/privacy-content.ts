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
export const EFFECTIVE_DATE = '17 September 2026';

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
      + 'yourself. On those pages it reads the URL to work out which pull request you are on, and '
      + 'then asks GitHub’s API for three things: the pull request’s diff, the text of each changed '
      + 'file at the commit under review, and the review comments already on it.',
      'Those requests go to GitHub and nowhere else, authenticated with the token you added. The '
      + 'results are rendered in the tab and held in memory until you close it.',
    ],
  },
  {
    title: 'What the extension stores',
    paragraphs: ['Four things, all in your own browser, none of them leaving it:'],
    points: [
      'The API token for each host you added, in the extension’s storage.',
      'Which files you have marked as viewed, per pull request, in the browser’s local storage.',
      'The width you dragged the file tree to.',
      'The hosts you have granted, which Chrome itself stores as extension permissions.',
    ],
  },
  {
    title: 'The token',
    paragraphs: [
      'Sofa reads everything through GitHub’s API: the pull request’s diff, the text of each '
      + 'changed file, and the review comments already on it. The API does not accept the session '
      + 'cookie your browser is already signed in with, so a token is how Sofa identifies itself, '
      + 'and without one there is nothing for it to render.',
      'A token you add in the extension’s popup is stored in the extension’s own storage, scoped to '
      + 'the host you entered it for. It is sent to that forge’s API and nowhere else, as the '
      + 'Authorization header. It is never exposed to the page, never logged, and never leaves your '
      + 'browser in any other direction. Clearing the field removes it.',
      'The permissions it needs are the smallest that work, and both are read-only: Pull requests: '
      + 'Read for the diff and the comments, and Contents: Read for the file bodies. Scoped that way, '
      + 'a stolen token could not write anything.',
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
      'github.com: the pull request pages Sofa runs on.',
      'api.github.com: where the diff, the file contents and the review comments are read from.',
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
