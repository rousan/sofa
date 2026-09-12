/**
 * The privacy policy page.
 *
 * A single narrow column: this is a document, not a pitch, and the only thing
 * it owes the reader is a straight answer.
 */
import { Footer } from './components/Footer.tsx';
import { Nav } from './components/Nav.tsx';
import { EFFECTIVE_DATE, POLICY } from './privacy-content.ts';
import { LINKS } from './content.ts';

/**
 * Render the policy.
 *
 * @returns The page.
 */
export function PrivacyPage() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[680px] px-5 pb-16">
        <header className="pt-16 pb-10 sm:pt-20">
          <h1 className="text-[30px] font-medium leading-[1.15] tracking-[-0.04em]">Privacy policy</h1>
          <p className="mt-3 text-ink-faint">
            For the Sofa Chrome extension and this website. In effect from {EFFECTIVE_DATE}.
          </p>
        </header>

        <div className="space-y-10">
          {POLICY.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mb-3 leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}
              {section.points && (
                <ul className="mt-3 space-y-2">
                  {section.points.map((point) => (
                    <li key={point.slice(0, 40)} className="flex gap-2.5 leading-relaxed text-ink-soft">
                      <span className="text-ink-faint" aria-hidden="true">&ndash;</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-edge pt-6 text-[12px] text-ink-faint">
          The extension&rsquo;s source, including everything described here, is at{' '}
          <a href={LINKS.repo} className="underline underline-offset-4 hover:text-ink">
            github.com/rousan/sofa
          </a>
          .
        </p>
      </main>

      <Footer />
    </>
  );
}
