/**
 * The whole page.
 *
 * One column, a few sections, no routing: everything a reader needs to decide
 * whether to install the extension, in the order they need it.
 */
import { Hero } from './components/Hero.tsx';
import { Section } from './components/Section.tsx';
import { FEATURES, INSTALL_COMMANDS, LINKS, SHORTCUTS } from './content.ts';

/**
 * Render the landing page.
 *
 * @returns The page.
 */
export function App() {
  return (
    <div className="mx-auto max-w-4xl px-6">
      <Hero />

      <Section title="The problem">
        <p className="mb-4 text-lg leading-relaxed">
          GitHub shows a diff as a handful of hunks with three lines of context around each one.
          When the change sits inside a long function, that is not enough to judge it: you cannot
          see what the variable was, what the branch above does, or whether the early return you
          are reading is the one that matters. Expanding line by line is slow, and sometimes it
          simply does not load.
        </p>
        <p className="leading-relaxed text-ink-soft">
          Sofa fetches the whole file at the pull request&rsquo;s head commit and renders every
          line of it, with added lines marked <span className="text-plus">green</span>, removed
          lines <span className="text-minus">red</span> and interleaved where they used to be, and
          both line-number gutters correct from the first line to the last.
        </p>
      </Section>

      <Section title="What you get">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h3 className="mb-1.5 font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{feature.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Keyboard">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {SHORTCUTS.map((shortcut) => (
              <tr key={shortcut.action} className="border-b border-edge">
                <td className="w-40 py-2 pr-4">
                  {shortcut.keys.map((key, index) => (
                    <span key={key}>
                      {index > 0 && <span className="mx-1 text-ink-soft">/</span>}
                      <kbd className="rounded border border-b-2 border-edge bg-surface-soft px-1.5 py-0.5 font-mono text-xs">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </td>
                <td className="py-2 text-ink-soft">{shortcut.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Install">
        <p className="mb-4 text-ink-soft">From source, until the store listing is approved:</p>
        <pre className="overflow-x-auto rounded-lg border border-edge bg-surface-soft p-4 font-mono text-sm leading-relaxed">
          <code>{INSTALL_COMMANDS.join('\n')}</code>
        </pre>
        <p className="mt-4 text-ink-soft">
          Then open <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-sm">chrome://extensions</code>,
          turn on Developer mode, choose <strong className="font-semibold text-ink">Load unpacked</strong>, and pick the{' '}
          <code className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-sm">apps/ext/dist</code> folder. Open any
          pull request and click the Sofa tab.
        </p>
      </Section>

      <Section title="Privacy">
        <p className="leading-relaxed text-ink-soft">
          Sofa reads the pages you already have open, using the session you are already signed in
          with. It collects nothing, sends nothing anywhere, and has no server of its own. The only
          thing it stores is which files you have marked viewed, in your browser, per pull request.
        </p>
      </Section>

      <footer className="border-t border-edge py-8 text-center text-sm text-ink-soft">
        <a href={LINKS.repo} className="hover:text-ink">
          Source on GitHub
        </a>
        <span className="mx-2">&middot;</span>
        built by{' '}
        <a href={LINKS.author} className="hover:text-ink">
          rousan
        </a>
      </footer>
    </div>
  );
}
