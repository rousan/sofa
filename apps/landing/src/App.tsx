/**
 * The landing page.
 *
 * A narrow single column on a grey canvas: the promise, the product, then the
 * specifications. The layout carries itself on type and spacing rather than
 * colour, because the screenshots are already full of GitHub's own, and a page
 * competing with them would only make them harder to read.
 */
import { Card, CardGrid } from './components/Card.tsx';
import { Footer } from './components/Footer.tsx';
import { Nav } from './components/Nav.tsx';
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
      <Nav />

      <main id="top" className="mx-auto max-w-[1120px] px-5 pb-24">
        <section className="mx-auto max-w-[460px] pt-10 pb-8 sm:pt-24 sm:pb-10">
          <h1 className="text-[26px] font-medium leading-[1.2] tracking-[-0.04em] sm:text-[34px] sm:leading-[1.15] lg:text-[38px]">{HERO.headline}</h1>
          <p className="mt-4 text-ink-soft">{HERO.subhead}</p>
          <div className="mt-6 flex items-center gap-3">
            <InstallButton size="lg" />
            <a href={LINKS.repo} className="text-ink-soft underline-offset-4 transition hover:text-ink hover:underline">
              or build from source
            </a>
          </div>
        </section>

        <Card caption="A tab of its own, beside Files changed. The file tree on the left, the whole file on the right. Swipe to see it all.">
          <div className="overflow-x-auto">
            <img
              src="/screenshot.png"
              alt="The Sofa tab open on a pull request: a file tree on the left, and on the right a whole file with an added line highlighted in green."
              className="block w-full min-w-[760px] sm:min-w-0"
            />
          </div>
        </Card>

        <div className="mx-auto mt-14 max-w-[880px] space-y-14 sm:mt-28 sm:space-y-20">
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

        <section className="mx-auto max-w-[460px] pt-16 text-center sm:pt-24">
          <h2 className="text-[22px] font-medium tracking-[-0.02em]">Read the next one properly.</h2>
          <div className="mt-5 flex justify-center">
            <InstallButton size="lg" />
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
