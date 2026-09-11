/**
 * The top of the page: what Sofa is, and where to get it.
 */
import { LINKS } from '../content.ts';

/**
 * Render the hero, including the screenshot beneath it.
 *
 * @returns The header and figure elements.
 */
export function Hero() {
  return (
    <>
      <header className="py-16 text-center sm:py-20">
        <img src="/icon.png" alt="" width={72} height={72} className="mx-auto mb-5 h-18 w-18 rounded-2xl" />
        <h1 className="mb-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Read a pull request like an editor
        </h1>
        <p className="mx-auto mb-7 max-w-2xl text-lg text-ink-soft sm:text-xl">
          Sofa adds a tab to GitHub that shows each changed file in full, with the diff spliced
          into it. No more judging a change through three lines of context.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={LINKS.store ?? LINKS.repo}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {LINKS.store ? 'Add to Chrome' : 'Get it on GitHub'}
          </a>
          <a
            href={LINKS.install}
            className="rounded-lg border border-edge bg-surface-soft px-5 py-2.5 text-sm font-semibold transition hover:border-brand"
          >
            Install instructions
          </a>
        </div>
        {!LINKS.store && (
          <p className="mt-4 text-sm text-ink-soft">
            Chrome Web Store listing is in review. Free and open source.
          </p>
        )}
      </header>

      <figure className="m-0">
        <img
          src="/screenshot.png"
          alt="The Sofa tab open on a GitHub pull request, showing a file tree on the left and a whole file with an added line highlighted on the right."
          className="w-full rounded-xl border border-edge"
        />
        <figcaption className="mt-3 text-center text-sm text-ink-soft">
          The Sofa tab, sitting next to Files changed.
        </figcaption>
      </figure>
    </>
  );
}
