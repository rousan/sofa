/**
 * A titled band of the page, separated from the one above it by a rule.
 */
import type { ReactNode } from 'react';

/**
 * Props for `Section`.
 */
interface SectionProps {
  /** Heading shown above the content. */
  title: string;
  /** The section's body. */
  children: ReactNode;
}

/**
 * Render one section of the page.
 *
 * @param props - The heading and the body to render under it.
 * @returns The section element.
 */
export function Section({ title, children }: SectionProps) {
  return (
    <section className="border-t border-edge py-14">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
