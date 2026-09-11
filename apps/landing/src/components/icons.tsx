/**
 * The page's glyphs, drawn inline.
 *
 * Inline SVG keeps the page to one request and lets every icon inherit its
 * colour from the text beside it, which is what makes them sit quietly in the
 * layout rather than shouting.
 */
import type { SVGProps } from 'react';

/**
 * Shared attributes: a 24-unit grid, stroked rather than filled, and sized by
 * the class the caller passes.
 */
const stroke: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

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
 * A page with lines on it, for the whole-file feature.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );
}

/**
 * A branching tree, for the file tree feature.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function TreeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M5 4v12a2 2 0 0 0 2 2h3M10 10H7" />
      <rect x="12" y="3" width="7" height="4" rx="1" />
      <rect x="12" y="9" width="7" height="4" rx="1" />
      <rect x="12" y="16" width="7" height="4" rx="1" />
    </svg>
  );
}

/**
 * A painter's palette, for the theming feature.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function PaletteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M12 21a9 9 0 1 1 9-9c0 2-1.6 3-3 3h-1.5a2 2 0 0 0-1.4 3.4c.4.5.4 1.2-.1 1.6-.6.5-1.4.7-2 .7Z" />
      <circle cx="7.5" cy="12" r="1" fill="currentColor" />
      <circle cx="10" cy="8" r="1" fill="currentColor" />
      <circle cx="15" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

/**
 * A keyboard, for the shortcuts feature.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

/**
 * A lightning bolt, for the speed feature.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
    </svg>
  );
}

/**
 * An office block, for the Enterprise feature.
 *
 * @param props - Anything to spread onto the svg.
 * @returns The icon.
 */
export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M15 21V11h3a2 2 0 0 1 2 2v8M3 21h18" />
      <path d="M8 8h3M8 12h3M8 16h3" />
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

/**
 * Every feature glyph, keyed the way the copy refers to them.
 */
export const FEATURE_ICONS = {
  file: FileIcon,
  tree: TreeIcon,
  palette: PaletteIcon,
  keyboard: KeyboardIcon,
  bolt: BoltIcon,
  building: BuildingIcon,
};
