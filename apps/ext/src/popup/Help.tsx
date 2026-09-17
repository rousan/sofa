/**
 * The Help tab: the handful of questions a token prompt always raises.
 *
 * It is written as collapsed entries rather than a page of prose so the popup
 * opens at a readable size, and someone who only wants the permission list does
 * not have to read past everything else to find it.
 */
import type { ReactNode } from 'react';

/**
 * One question and its answer.
 */
interface Entry {
  /** The question, shown as the summary line. */
  q: string;
  /** The answer, revealed when the entry is opened. */
  a: ReactNode;
}

/**
 * A GitHub permission name, set apart from the prose around it.
 *
 * @param props - The permission to render.
 * @returns The styled name.
 */
function Perm({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[10.5px] text-ink">{children}</span>;
}

/**
 * The FAQ, in the order the questions tend to arrive.
 */
const ENTRIES: Entry[] = [
  {
    q: 'What is a token?',
    a: (
      <>
        A fine-grained personal access token: a string GitHub issues that proves a request is yours.
        Sofa sends it with every API call it makes on your behalf, so a comment you leave is posted
        as you.
      </>
    ),
  },
  {
    q: 'Why does Sofa need one?',
    a: (
      <>
        Sofa reads the pull request&rsquo;s diff, the full text of each changed file, and the review
        comments from the GitHub API, and posts your comments back the same way. The API does not
        accept the session cookie your browser is already logged in with, so without a token there is
        nothing for Sofa to render.
      </>
    ),
  },
  {
    q: 'Which permissions does it need?',
    a: (
      <>
        Two, and both are required: <Perm>Contents: Read</Perm> and{' '}
        <Perm>Pull requests: Read and write</Perm>. Read alone is enough to view a pull request, but
        leaving a comment, replying, or submitting a review needs the write half &mdash; without it
        those actions fail. Nothing beyond these two is requested, so Sofa can never touch a branch,
        a setting, or a repository&rsquo;s contents.
      </>
    ),
  },
  {
    q: 'How do I create one?',
    a: (
      <>
        On GitHub: <Perm>Settings &rarr; Developer settings &rarr; Personal access tokens &rarr;
        Fine-grained tokens &rarr; Generate new token</Perm>. Choose the repositories you review, set
        the two permissions above, then copy the token and paste it into the Hosts tab. The
        <span className="text-ink"> Create a token</span> link there opens the right page already.
      </>
    ),
  },
  {
    q: 'Where is the token kept?',
    a: (
      <>
        In your browser profile, via <Perm>chrome.storage.local</Perm>. It is attached to requests by
        the extension&rsquo;s service worker, so it is never handed to the GitHub page itself, and it
        goes nowhere except the host you saved it for.
      </>
    ),
  },
  {
    q: 'Can I use a classic token?',
    a: (
      <>
        Yes &mdash; a classic token with the <Perm>repo</Perm> scope works. Fine-grained is worth the
        extra minute: <Perm>repo</Perm> is all-or-nothing and grants far more than Sofa asks for,
        across every repository you can reach.
      </>
    ),
  },
  {
    q: 'How do I add a company GitHub host?',
    a: (
      <>
        Type its hostname at the bottom of the Hosts tab and accept Chrome&rsquo;s prompt. That host
        issues its own tokens, so create one there too. The grant lives in your profile only.
      </>
    ),
  },
];

/**
 * Render the Help tab.
 *
 * @returns The FAQ list.
 */
export function Help() {
  return (
    <div className="px-3.5 py-1">
      {ENTRIES.map((entry) => (
        <details key={entry.q} className="group border-b border-edge py-2 last:border-b-0">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] marker:content-none">
            <span className="text-ink-soft transition group-open:text-ink">{entry.q}</span>
            <span
              aria-hidden="true"
              className="ml-auto text-[10px] text-ink-faint transition group-open:rotate-90"
            >
              &#9656;
            </span>
          </summary>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">{entry.a}</p>
        </details>
      ))}

      <p className="border-t border-edge py-2.5 text-[11px] text-ink-faint">
        <a
          href="https://sofa.rousanali.com/"
          target="_blank"
          rel="noreferrer"
          className="transition hover:text-ink"
        >
          sofa.rousanali.com &rarr;
        </a>
      </p>
    </div>
  );
}
