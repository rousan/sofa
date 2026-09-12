/**
 * The foot of every page, wordmark and all.
 */
import { LINKS } from '../content.ts';

/**
 * Render the footer.
 *
 * @returns The footer element.
 */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-edge pt-8">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 text-[12px] text-ink-faint">
        <span>&copy; 2026 Sofa. Free and open source.</span>
        <span className="flex items-center gap-5">
          <a href="/privacy/" className="transition hover:text-ink">Privacy</a>
          <a href={LINKS.repo} className="transition hover:text-ink">Source</a>
          <a href={LINKS.issues} className="transition hover:text-ink">Report a bug</a>
          <a href={LINKS.author} className="transition hover:text-ink">rousan</a>
        </span>
      </div>

      {/*
        The name at the size the page can afford to give it. Monospace makes the
        fit exact rather than guessed: every glyph is 0.6em wide, so four of them
        fill the column at a shade under half its width, and the descender space
        is pulled off so the word sits on the bottom edge.
      */}
      <div className="mx-auto mt-10 max-w-[1120px] overflow-hidden px-5" aria-hidden="true">
        <p className="-mb-[0.2em] select-none text-[min(39vw,438px)] font-bold leading-none tracking-[-0.05em] text-ink/10">
          sofa
        </p>
      </div>
    </footer>
  );
}
