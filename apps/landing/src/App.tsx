/**
 * The landing page.
 *
 * One column, read top to bottom: what it is, what the difference looks like,
 * what you get, how it feels to use, what it does with your data, and where to
 * get it. The install button repeats at the top, in the hero and at the end,
 * because that is the only action the page is asking for.
 */
import { BrowserFrame } from './components/BrowserFrame.tsx';
import { Comparison } from './components/Comparison.tsx';
import { InstallButton } from './components/InstallButton.tsx';
import { FEATURE_ICONS, GitHubIcon } from './components/icons.tsx';
import { FAQ, FEATURES, HERO, INSTALL_COMMANDS, LINKS, SHORTCUTS } from './content.ts';

/**
 * A titled band of the page.
 *
 * @param props - The heading, an optional standfirst, and the body.
 * @returns The section.
 */
function Section({ title, lede, children, id }: { title: string; lede?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-edge py-16 sm:py-20">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {lede && <p className="mt-3 max-w-2xl text-ink-soft">{lede}</p>}
      <div className="mt-8">{children}</div>
    </section>
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
      <header className="sticky top-0 z-20 border-b border-edge/60 bg-surface/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src="/icon.png" alt="" width={26} height={26} className="rounded-md" />
            Sofa
          </a>
          <div className="ml-auto hidden items-center gap-6 text-sm text-ink-soft sm:flex">
            <a href="#features" className="transition hover:text-ink">Features</a>
            <a href="#shortcuts" className="transition hover:text-ink">Shortcuts</a>
            <a href="#faq" className="transition hover:text-ink">FAQ</a>
            <a href={LINKS.repo} className="flex items-center gap-1.5 transition hover:text-ink">
              <GitHubIcon className="h-4 w-4" />
              Source
            </a>
          </div>
          <div className="ml-auto sm:ml-0">
            <InstallButton />
          </div>
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-5xl px-6">
        <div className="relative py-16 text-center sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[28rem] bg-[radial-gradient(55%_60%_at_50%_0%,color-mix(in_oklab,var(--color-brand)_28%,transparent),transparent_70%)] blur-2xl"
          />
          <p className="mb-4 inline-flex items-center rounded-full border border-edge bg-surface-soft px-3 py-1 text-xs font-medium text-ink-soft">
            {HERO.eyebrow}
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.05]">
            {HERO.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft">{HERO.subhead}</p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <InstallButton size="lg" />
            <a
              href={LINKS.repo}
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-soft px-6 py-3.5 font-semibold transition hover:border-brand"
            >
              <GitHubIcon className="h-4 w-4" />
              View source
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
            {HERO.trust.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <span className="text-plus">&#10003;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <BrowserFrame url="github.com/react/react-native/pull/58486/files">
          <img
            src="/screenshot.png"
            alt="The Sofa tab open on a pull request: a file tree on the left, and on the right a whole file with an added line highlighted in green."
            className="block w-full"
          />
        </BrowserFrame>

        <Section
          title="Three lines of context is not a review"
          lede="When a change sits inside a long function, the hunk tells you what moved but not whether it is right. Sofa fetches the file at the pull request's head commit and renders all of it."
        >
          <Comparison />
        </Section>

        <Section id="features" title="What you get">
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature.icon];
              return (
                <div key={feature.title}>
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-surface-soft text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-1.5 font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section id="shortcuts" title="Built for the keyboard" lede="Read a pull request without reaching for the mouse.">
          <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={shortcut.action} className="flex items-center gap-4 border-b border-edge py-3">
                <span className="flex w-24 shrink-0 items-center gap-1">
                  {shortcut.keys.map((key, index) => (
                    <span key={key} className="flex items-center gap-1">
                      {index > 0 && <span className="text-xs text-ink-soft">/</span>}
                      <kbd className="rounded-md border border-b-2 border-edge bg-surface-soft px-2 py-0.5 font-mono text-xs">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </span>
                <span className="text-sm text-ink-soft">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section id="faq" title="Questions">
          <div className="divide-y divide-edge border-y border-edge">
            {FAQ.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.question}
                  <span className="text-ink-soft transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft">{item.answer}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="border-t border-edge py-16 text-center sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Read the next pull request properly</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">
            {LINKS.store
              ? 'Install it in a click. It adds one tab and changes nothing else.'
              : 'The Chrome Web Store listing is in review. Until it lands, build it from source:'}
          </p>
          {!LINKS.store && (
            <pre className="mx-auto mt-6 max-w-2xl overflow-x-auto rounded-xl border border-edge bg-surface-soft p-4 text-left font-mono text-sm">
              <code>{INSTALL_COMMANDS.join('\n')}</code>
            </pre>
          )}
          <div className="mt-8 flex justify-center">
            <InstallButton size="lg" />
          </div>
        </section>
      </main>

      <footer className="border-t border-edge py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-ink-soft">
          <span>Free and open source. No tracking, no server, no account.</span>
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
