/**
 * Small helpers shared across the extension.
 */
import type { PrContext } from './types.ts';

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
 * Escape a string so it can be embedded in HTML text or an attribute value.
 *
 * Needed because the viewer builds its rows as one markup string for speed.
 *
 * @param value - Raw text that may contain HTML metacharacters.
 * @returns The text with `& < > " '` replaced by entities.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
 * Wrap a function so rapid calls collapse into a single trailing call.
 *
 * Used for the file filter and the navigation watcher, both of which would
 * otherwise fire far more often than the UI needs.
 *
 * @param fn - The function to defer.
 * @param waitMs - Quiet period, in milliseconds, before firing.
 * @returns The debounced wrapper.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };
}

/**
 * Format an integer with thousands separators for the counters in the UI.
 *
 * @param value - The number to format.
 * @returns A locale-independent grouped representation.
 */
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Split file text into lines without inventing a trailing empty line.
 *
 * A file ending in a newline would otherwise gain a phantom last line in the
 * viewer, which would also push every old-revision line number out by one.
 *
 * @param text - Full file contents.
 * @returns One entry per line of the file.
 */
export function splitLines(text: string): string[] {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
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
