/**
 * A browser window drawn around the product screenshot.
 *
 * The chrome is decorative: it tells the reader at a glance that they are
 * looking at a real page rather than a diagram, which a bare screenshot on a
 * white background does not.
 */
import type { ReactNode } from 'react';

/**
 * Props for `BrowserFrame`.
 */
interface BrowserFrameProps {
  /** The address to show in the fake bar. */
  url: string;
  /** What sits inside the window. */
  children: ReactNode;
}

/**
 * Render the framed window.
 *
 * @param props - The address bar text and the window's contents.
 * @returns The frame.
 */
export function BrowserFrame({ url, children }: BrowserFrameProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface-soft shadow-2xl shadow-black/10 ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex-1 truncate rounded-md bg-surface px-3 py-1 text-center font-mono text-[11px] text-ink-soft">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}
