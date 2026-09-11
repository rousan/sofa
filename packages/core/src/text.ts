/**
 * Text helpers with no dependency on a browser.
 *
 * They live in the core package because the diff parser, the model and the
 * highlighter all need them, and none of those should reach for the DOM.
 */

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
 * Wrap a function so rapid calls collapse into a single trailing call.
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
