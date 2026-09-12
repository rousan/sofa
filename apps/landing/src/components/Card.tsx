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
 * Props for `CardGrid`.
 */
interface CardGridProps {
  /** The cards, each a heading and a sentence or two. */
  items: { term: string; detail: string }[];
  /** How many across on a wide screen. */
  columns?: 2 | 3;
}

/**
 * Render a grid of small cards.
 *
 * Each claim gets its own box, which is easier to skim than a table and easier
 * to extend than a paragraph: one fact per card, and the eye can stop wherever
 * it likes.
 *
 * @param props - The cards and how wide to lay them out.
 * @returns The grid.
 */
export function CardGrid({ items, columns = 3 }: CardGridProps) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}>
      {items.map((item) => (
        <div key={item.term} className="rounded-2xl border border-edge bg-card p-5">
          <h3 className="mb-1.5 font-semibold">{item.term}</h3>
          <p className="m-0 text-ink-soft">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}
