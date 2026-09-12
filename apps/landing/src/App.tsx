/**
 * The landing page.
 *
 * A narrow single column on a grey canvas: the promise, the product, then the
 * specifications. The layout carries itself on type and spacing rather than
 * colour, because the screenshots are already full of GitHub's own, and a page
 * competing with them would only make them harder to read.
 */
import { Card, CardGrid } from './components/Card.tsx';
import { Comparison } from './components/Comparison.tsx';
import { InstallButton } from './components/InstallButton.tsx';
import { GitHubIcon } from './components/icons.tsx';
import { HERO, HOW_IT_WORKS, LINKS, PRIVACY, REQUIREMENTS, SHORTCUTS } from './content.ts';

/**
 * A small label above a band of cards.
 *
 * @param props - The label text.
 * @returns The heading.
 */
function Label({ children }: { children: string }) {
  return (
    <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{children}</h2>
  );
}

/**
 * Render the page.
 *
 * @returns The whole document body.
 */
export function App() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-edge/70 bg-canvas/85 backdrop-blur">
        <nav className="mx-auto flex max-w-[1120px] items-center gap-3 px-5 py-2.5">
          <a href="#top" className="flex items-center gap-1.5 font-semibold">
            <img src="/icon.png" alt="" width={18} height={18} className="rounded" />
            Sofa
          </a>
          <span className="text-ink-faint">Chrome extension</span>
          <a href={LINKS.repo} className="ml-auto hidden items-center gap-1.5 text-ink-soft transition hover:text-ink sm:flex">
            <GitHubIcon className="h-3.5 w-3.5" />
            GitHub
          </a>
          <span className="ml-auto sm:ml-4">
            <InstallButton />
          </span>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-[1120px] px-5 pb-24">
        <section className="mx-auto max-w-[460px] pt-16 pb-10 sm:pt-24">
          <h1 className="text-[34px] font-medium leading-[1.15] tracking-[-0.04em] sm:text-[38px]">{HERO.headline}</h1>
          <p className="mt-4 text-ink-soft">{HERO.subhead}</p>
          <div className="mt-6 flex items-center gap-3">
            <InstallButton size="lg" />
            <a href={LINKS.repo} className="text-ink-soft underline-offset-4 transition hover:text-ink hover:underline">
              or build from source
            </a>
          </div>
        </section>

        <Card caption="A tab of its own, beside Files changed. The file tree on the left, the whole file on the right.">
          <img
            src="/screenshot.png"
            alt="The Sofa tab open on a pull request: a file tree on the left, and on the right a whole file with an added line highlighted in green."
            className="block w-full"
          />
        </Card>

        <div className="mx-auto mt-28 max-w-[880px] space-y-20">
          <div>
            <Comparison />
            <p className="mx-auto mt-3 max-w-lg text-center text-[12px] leading-5 text-ink-faint">
              Two lines forgot to pass the comparator down. GitHub shows you the lines; Sofa shows you
              the function, where the default comparator that makes it wrong is four lines above.
            </p>
          </div>

          <div>
            <Label>What it does</Label>
            <CardGrid items={HOW_IT_WORKS} />
          </div>

          <div>
            <Label>Keyboard</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.action} className="flex items-center gap-3 rounded-2xl border border-edge bg-card px-4 py-3.5">
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key, index) => (
                      <span key={key} className="flex items-center gap-1">
                        {index > 0 && <span className="text-[11px] text-ink-faint">/</span>}
                        <kbd className="rounded border border-edge bg-canvas px-1.5 py-0.5 font-mono text-[11px] font-medium">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </span>
                  <span className="text-ink-soft">{shortcut.action}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>What it needs</Label>
            <CardGrid items={REQUIREMENTS} columns={2} />
          </div>

          <div>
            <Label>Private by design</Label>
            <CardGrid items={PRIVACY} columns={2} />
          </div>

        </div>

        <section className="mx-auto max-w-[460px] pt-24 text-center">
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">Read the next one properly.</h2>
          <div className="mt-5 flex justify-center">
            <InstallButton size="lg" />
          </div>
        </section>
      </main>

      <footer className="border-t border-edge py-8">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 text-[12px] text-ink-faint">
          <span>&copy; 2026 Sofa. Free and open source.</span>
          <span className="flex items-center gap-5">
            <a href={LINKS.repo} className="transition hover:text-ink">Source</a>
            <a href={LINKS.issues} className="transition hover:text-ink">Report a bug</a>
            <a href={LINKS.author} className="transition hover:text-ink">rousan</a>
          </span>
        </div>
      </footer>
    </>
  );
}
