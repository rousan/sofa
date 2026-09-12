/**
 * The white blocks the page is built from.
 *
 * Every piece of content sits in one: a visual, a spec table, a code block. It
 * is the only structural idea in the layout, which is what keeps a page of
 * quite different content reading as one thing.
 */
import type { ReactNode } from 'react';

/**
 * Props for `Card`.
 */
interface CardProps {
  /** The card's contents. */
  children: ReactNode;
  /** A muted line beneath the card, used under visuals. */
  caption?: string;
  /** Extra classes for the card itself. */
  className?: string;
}

/**
 * Render a card, and its caption if it has one.
 *
 * @param props - Contents, optional caption, optional extra classes.
 * @returns The card.
 */
export function Card({ children, caption, className = '' }: CardProps) {
  return (
    <figure className="m-0">
      <div className={`overflow-hidden rounded-2xl border border-edge bg-card ${className}`}>{children}</div>
      {caption && (
        <figcaption className="mx-auto mt-3 max-w-md text-center text-[12px] leading-5 text-ink-faint">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Props for `SpecCard`.
 */
interface SpecCardProps {
  /** The small uppercase label at the top of the card. */
  label: string;
  /** The rows, each a term and its explanation. */
  rows: { term: string; detail: string }[];
}

/**
 * Render a labelled table of terms.
 *
 * This is the page's workhorse: how it works, what it needs, what it does with
 * your data. A row is far easier to scan than a paragraph, and it forces the
 * copy to stay honest about each claim.
 *
 * @param props - The label and the rows.
 * @returns The card.
 */
export function SpecCard({ label, rows }: SpecCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-card">
      <p className="px-5 pt-5 pb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{label}</p>
      <dl className="m-0">
        {rows.map((row) => (
          <div key={row.term} className="grid grid-cols-[minmax(96px,150px)_1fr] gap-4 border-t border-edge px-5 py-3.5">
            <dt className="text-ink">{row.term}</dt>
            <dd className="m-0 text-ink-soft">{row.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
