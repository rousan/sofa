/**
 * The page's two glyphs, drawn inline.
 *
 * Inline SVG keeps the page to one request. There are only two: the layout
 * carries itself on type and spacing, and decorative icons would work against
 * that.
 */
import type { SVGProps } from 'react';

/**
 * Chrome's four-part roundel, used on the install button.
 *
 * @param props - Anything to spread onto the svg, typically a class.
 * @returns The icon.
 */
export function ChromeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <circle cx="24" cy="24" r="20" fill="#fff" />
      <path fill="#EA4335" d="M24 4a20 20 0 0 1 17.3 10H24a10 10 0 0 0-8.6 4.9L8.1 12A19.9 19.9 0 0 1 24 4Z" />
      <path fill="#34A853" d="M8.1 12l7.3 6.9A10 10 0 0 0 24 34l-6.7 9.3A20 20 0 0 1 8.1 12Z" />
      <path fill="#FBBC05" d="M41.3 14A20 20 0 0 1 17.3 43.3L24 34a10 10 0 0 0 9.6-13.1L41.3 14Z" />
      <circle cx="24" cy="24" r="8.4" fill="#fff" />
      <circle cx="24" cy="24" r="6.4" fill="#4285F4" />
    </svg>
  );
}

/**
 * GitHub's mark, for the source links.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
