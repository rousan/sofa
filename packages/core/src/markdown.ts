/**
 * A small Markdown renderer for review comment bodies.
 *
 * It exists because a comment shown as raw source misrepresents what someone
 * wrote: a fenced code block arrives as a wall of backticks, and a link arrives
 * as brackets around a URL. The subset here is the one that actually turns up
 * in code review - code, emphasis, links, lists, quotes, headings - and not the
 * whole of GitHub Flavored Markdown.
 *
 * Everything is escaped before any markup is produced, and no raw HTML from the
 * source is ever passed through. That is not a nicety: comment bodies are
 * written by other people and rendered into GitHub's own page, so an unescaped
 * one would be script injection on a page holding the reader's session.
 */
import { escapeHtml } from './text.ts';

/**
 * URL schemes a link is allowed to use.
 *
 * Anything else - `javascript:` above all - is rendered as plain text rather
 * than as a link, so a crafted comment cannot produce a clickable script.
 */
const SAFE_SCHEME = /^(https?:|mailto:)/i;

/**
 * Marks where a run of text was lifted out of the source.
 *
 * Fenced code and inline code are pulled out before the rest is processed, so
 * their contents cannot be mistaken for emphasis or a link. The delimiter is a
 * control character no keyboard produces and `escapeHtml` leaves alone, so a
 * placeholder cannot be forged by the comment itself.
 *
 * @param kind - Which pass owns the placeholder.
 * @param index - Position in that pass's list.
 * @returns The placeholder string.
 */
function slot(kind: string, index: number): string {
  return `\u0001${kind}${index}\u0001`;
}

/**
 * Turn a URL from the source into an href, or reject it.
 *
 * @param raw - The URL exactly as written in the comment.
 * @returns An escaped href, or null when the scheme is not one we allow.
 */
function safeHref(raw: string): string | null {
  const url = raw.trim();
  // A bare path or a protocol-relative URL has no scheme to check and would
  // resolve against the forge page, so only absolute known-safe ones are kept.
  if (!SAFE_SCHEME.test(url)) return null;
  return escapeHtml(url);
}

/**
 * Render the inline constructs inside one already-escaped run of text.
 *
 * The order matters. Inline code is removed first so that backticked text
 * cannot be re-read as emphasis; explicit links go next so their URLs are not
 * caught by the bare-URL pass; emphasis is last because it is the only pass
 * that can safely run over whatever remains.
 *
 * @param escaped - Text that has already been through `escapeHtml`.
 * @returns HTML for that run.
 */
function renderInline(escaped: string): string {
  const codes: string[] = [];
  const links: string[] = [];

  // Inline code, double backticks first so a span containing a backtick works.
  let out = escaped.replace(/``([^`]+)``|`([^`\n]+)`/g, (_match, double: string, single: string) => {
    codes.push(`<code>${double ?? single}</code>`);
    return slot('C', codes.length - 1);
  });

  // Images are rendered as links rather than fetched. A comment can otherwise
  // pull an arbitrary remote image into the page, which both reports the reader
  // to whoever hosts it and can push the thread to any height it likes.
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (match, alt: string, url: string) => {
    const href = safeHref(url);
    if (!href) return match;
    links.push(`<a href="${href}" target="_blank" rel="noreferrer noopener">${alt || 'image'}</a>`);
    return slot('L', links.length - 1);
  });

  // Explicit links: [text](url), with an optional title we drop.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (match, label: string, url: string) => {
    const href = safeHref(url);
    if (!href) return match;
    links.push(`<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`);
    return slot('L', links.length - 1);
  });

  // Bare URLs. Bounded by whitespace or an opening bracket so a URL already
  // inside a link's markup is not matched twice, and trailing punctuation is
  // left out of the href because a sentence usually ends after one.
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g, (_match, before: string, url: string) => {
    const href = safeHref(url);
    if (!href) return `${before}${url}`;
    links.push(`<a href="${href}" target="_blank" rel="noreferrer noopener">${url}</a>`);
    return `${before}${slot('L', links.length - 1)}`;
  });

  out = out
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    // Single-character emphasis refuses to start mid-word, so that a
    // snake_case_identifier in prose survives intact.
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');

  return out
    .replace(/\u0001L(\d+)\u0001/g, (_match, index: string) => links[Number(index)] ?? '')
    .replace(/\u0001C(\d+)\u0001/g, (_match, index: string) => codes[Number(index)] ?? '');
}

/**
 * How far a line is indented, in spaces.
 *
 * A tab counts as four, so a list written with either survives nesting.
 *
 * @param line - The raw line.
 * @returns The indent width.
 */
function indentOf(line: string): number {
  const prefix = /^[\t ]*/.exec(line)?.[0] ?? '';
  return prefix.replace(/\t/g, '    ').length;
}

/**
 * What a line opens, when it opens a list item.
 */
interface ListMark {
  /** The indent the item sits at. */
  indent: number;
  /** True for `1.`, false for `-`, `*` or `+`. */
  ordered: boolean;
  /** The text after the marker. */
  rest: string;
}

/**
 * Read a line as a list item, if it is one.
 *
 * @param line - The raw line.
 * @returns The item's shape, or null when the line is not a list item.
 */
function listMark(line: string): ListMark | null {
  const match = /^[\t ]*([-*+]|\d+[.)])[\t ]+(.*)$/.exec(line);
  if (!match) return null;
  return { indent: indentOf(line), ordered: /\d/.test(match[1] ?? ''), rest: match[2] ?? '' };
}

/**
 * Render one list item's text, turning a task marker into a checkbox.
 *
 * @param text - The item's text, after its bullet.
 * @returns The item's inner HTML.
 */
function renderItemText(text: string): string {
  const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
  if (!task) return renderInline(escapeHtml(text));
  const checked = task[1] !== ' ' ? ' checked' : '';
  return `<input type="checkbox" disabled${checked} /> ${renderInline(escapeHtml(task[2] ?? ''))}`;
}

/**
 * Render a run of lines making up one list, including any nested lists.
 *
 * @param lines - Every line of the document.
 * @param start - Index of the list's first line.
 * @param indent - The indent this list's own items sit at.
 * @returns The list's HTML, and the index of the first line after it.
 */
function renderList(lines: string[], start: number, indent: number): [string, number] {
  const first = listMark(lines[start] ?? '');
  if (!first) return ['', start];

  const items: string[] = [];
  let i = start;
  let current: string | null = null;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const mark = listMark(line);

    // A more deeply indented list belongs inside the item that precedes it.
    if (mark && current !== null && mark.indent > indent) {
      const [nested, next] = renderList(lines, i, mark.indent);
      current += nested;
      i = next;
      continue;
    }

    if (mark && mark.indent === indent && mark.ordered === first.ordered) {
      if (current !== null) items.push(current);
      current = renderItemText(mark.rest);
      i += 1;
      continue;
    }

    // A plain indented line continues the item above it.
    if (current !== null && !mark && line.trim() !== '' && indentOf(line) > indent) {
      current += ` ${renderInline(escapeHtml(line.trim()))}`;
      i += 1;
      continue;
    }

    break;
  }

  if (current !== null) items.push(current);
  const tag = first.ordered ? 'ol' : 'ul';
  return [`<${tag}>${items.map((item) => `<li>${item}</li>`).join('')}</${tag}>`, i];
}

/**
 * Whether a line is a lifted-out fenced code block.
 *
 * @param line - The line to test.
 * @returns True when the line is nothing but a fence placeholder.
 */
function isFence(line: string): boolean {
  return /^\u0001F\d+\u0001$/.test(line.trim());
}

/**
 * Render a document's block structure.
 *
 * Separate from `renderMarkdown`, and taking lines rather than a string,
 * because a blockquote's contents are rendered by calling it again.
 *
 * @param lines - The lines to render.
 * @returns The blocks' HTML.
 */
function renderBlocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // A fence was lifted out before this pass and left a placeholder on a line
    // of its own; it must not be wrapped in a paragraph.
    if (isFence(line)) {
      out.push(line.trim());
      i += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      // Comment headings are rendered small. A comment sits inside a diff, and
      // an h1 at document scale would dwarf the code it is about.
      const level = Math.min(6, (heading[1] ?? '').length + 2);
      out.push(`<h${level}>${renderInline(escapeHtml(heading[2] ?? ''))}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s{0,3}(-\s*-\s*-|\*\s*\*\s*\*|_\s*_\s*_)[-*_\s]*$/.test(line)) {
      out.push('<hr />');
      i += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const quoted: string[] = [];
      // A quote runs on through lines that do not repeat the marker, which is
      // how a wrapped quoted paragraph arrives from most editors.
      while (i < lines.length && (/^\s{0,3}>/.test(lines[i] ?? '') || (quoted.length > 0 && (lines[i] ?? '').trim() !== ''))) {
        quoted.push((lines[i] ?? '').replace(/^\s{0,3}>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${renderBlocks(quoted)}</blockquote>`);
      continue;
    }

    const mark = listMark(line);
    if (mark) {
      const [html, next] = renderList(lines, i, mark.indent);
      out.push(html);
      i = next;
      continue;
    }

    // Anything else is a paragraph, running until a blank line or a line that
    // starts a block of its own.
    const paragraph: string[] = [];
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (next.trim() === '') break;
      if (listMark(next) || /^\s{0,3}>/.test(next) || /^#{1,6}\s/.test(next) || isFence(next)) break;
      paragraph.push(next);
      i += 1;
    }
    // Single newlines inside a paragraph are breaks, as they are in a comment
    // box on the forge itself, rather than being collapsed into a space.
    const body = paragraph.map((part) => renderInline(escapeHtml(part))).join('<br />');
    out.push(`<p>${body}</p>`);
  }

  return out.join('');
}

/**
 * Render a comment body as HTML.
 *
 * @param source - The Markdown a reviewer wrote.
 * @returns HTML safe to insert into the page.
 */
export function renderMarkdown(source: string): string {
  if (!source) return '';

  const fences: string[] = [];
  const text = String(source).replace(/\r\n?/g, '\n');

  // Fenced code comes out first, before anything else can look inside it. An
  // unterminated fence runs to the end of the comment, which is what the forge
  // does with one too.
  const withoutFences = text.replace(
    /^```([^\n`]*)\n([\s\S]*?)(?:^```[\t ]*$|(?![\s\S]))/gm,
    (_match, lang: string, body: string) => {
      const language = lang.trim().replace(/[^\w.+-]/g, '');
      const attribute = language ? ` data-language="${escapeHtml(language)}"` : '';
      fences.push(`<pre${attribute}><code>${escapeHtml(body.replace(/\n$/, ''))}</code></pre>`);
      return slot('F', fences.length - 1);
    },
  );

  return renderBlocks(withoutFences.split('\n'))
    .replace(/\u0001F(\d+)\u0001/g, (_match, index: string) => fences[Number(index)] ?? '');
}
