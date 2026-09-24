/**
 * Browser-side helpers.
 *
 * Anything here needs a DOM or the browser's storage; the parts that do not are
 * in `@sofa/core`.
 */
import type { PrContext } from '@sofa/core';

/**
 * Options accepted by the `el` element factory.
 */
export interface ElementOptions {
  /** Class attribute for the new element. */
  className?: string;
  /** Text content, set safely via `textContent`. */
  text?: string;
  /** Markup for the element's contents; only ever passed pre-escaped strings. */
  html?: string;
  /** Attributes to set; null and undefined values are skipped. */
  attrs?: Record<string, string | number | null | undefined>;
  /** Children to append; falsy entries are ignored. */
  children?: (Node | null | undefined)[];
}

/**
 * Create an element with class names, attributes, text and children in one call.
 *
 * Keeps the UI builders readable without pulling in a framework.
 *
 * @param tag - Tag name to create.
 * @param options - Class, content, attributes and children for the element.
 * @returns The configured element.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  if (options.html != null) node.innerHTML = options.html;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value != null) node.setAttribute(key, String(value));
    }
  }
  for (const child of options.children ?? []) {
    if (child) node.appendChild(child);
  }
  return node;
}

/**
 * Read a persisted preference, tolerating environments where storage throws.
 *
 * @param key - Storage key to read.
 * @returns The stored value, or null when it is unavailable.
 */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write a persisted preference, ignoring storage failures.
 *
 * @param key - Storage key to write.
 * @param value - Value to store.
 */
export function writeSetting(key: string, value: string): void {
  try {
        localStorage.setItem(key, value);
  } catch {
    // Preferences are a convenience; a storage failure must not break the panel.
  }
}

/**
 * Build the storage key that scopes viewed state to a single pull request.
 *
 * @param ctx - The pull request being reviewed.
 * @returns A stable per-pull-request key.
 */
function viewedKey(ctx: PrContext): string {
  return `sofa:viewed:${ctx.owner}/${ctx.repo}#${ctx.number}`;
}

/**
 * Read the set of paths the user has marked as viewed for one pull request.
 *
 * @param ctx - The pull request being reviewed.
 * @returns Paths previously marked viewed.
 */
export function loadViewed(ctx: PrContext): Set<string> {
  const raw = readSetting(viewedKey(ctx));
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

/**
 * Persist the viewed-path set for one pull request.
 *
 * @param ctx - The pull request being reviewed.
 * @param viewed - Paths currently marked viewed.
 */
export function saveViewed(ctx: PrContext, viewed: Set<string>): void {
  writeSetting(viewedKey(ctx), JSON.stringify([...viewed]));
}

/**
 * Build a 16px Octicon-shaped SVG.
 *
 * GitHub's own icons are inlined per use rather than served as a sprite, so
 * there is nothing on the page to reference; Sofa draws its own at the same
 * size and inherits colour through `currentColor`.
 *
 * @param className - Class applied to the svg, which colours it via currentColor.
 * @param paths - One or more path definitions to draw.
 * @param title - Accessible label, omitted for purely decorative icons.
 * @returns The icon element.
 */
export function icon(className: string, paths: readonly string[], title?: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  if (title) svg.setAttribute('aria-label', title);
  for (const definition of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', definition);
    svg.appendChild(path);
  }
  return svg;
}
