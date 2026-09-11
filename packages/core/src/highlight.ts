/**
 * A small, dependency-free syntax highlighter.
 *
 * GitHub's content security policy blocks loading a real highlighter from a CDN,
 * and bundling one would dwarf the rest of this extension, so this module
 * tokenises only what carries most of the visual signal: comments, strings,
 * numbers and keywords. Anything it does not recognise becomes plain text.
 */
import { escapeHtml } from './text.ts';

/**
 * The language families the highlighter knows about.
 */
export type Language = 'cfamily' | 'java' | 'go' | 'python' | 'shell' | 'json' | 'yaml' | 'css';

/**
 * Carry-over state between lines, so an open block comment keeps its colour.
 */
export interface HighlightState {
  /** True while a block comment opened on an earlier line is still open. */
  block: boolean;
}

/**
 * Keyword sets per language family.
 *
 * Kept small on purpose: a missed keyword renders as plain text, which is
 * harmless, whereas an over-eager match is visually noisy.
 */
const KEYWORDS: Record<Language, Set<string>> = {
  cfamily: new Set([
    'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'constructor',
    'continue', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
    'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import', 'in', 'instanceof',
    'interface', 'let', 'new', 'of', 'private', 'protected', 'public', 'readonly', 'return',
    'satisfies', 'set', 'static', 'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof',
    'var', 'void', 'while', 'yield', 'true', 'false', 'null', 'undefined',
  ]),
  java: new Set([
    'abstract', 'boolean', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default',
    'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'if',
    'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package',
    'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'synchronized',
    'this', 'throw', 'throws', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var',
  ]),
  go: new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough',
    'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range',
    'return', 'select', 'struct', 'switch', 'type', 'var', 'nil', 'true', 'false',
  ]),
  python: new Set([
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
    'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
    'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'False', 'try', 'while',
    'with', 'yield', 'self',
  ]),
  shell: new Set([
    'case', 'do', 'done', 'elif', 'else', 'esac', 'export', 'fi', 'for', 'function', 'if', 'in',
    'local', 'return', 'then', 'while', 'set', 'source',
  ]),
  json: new Set(['true', 'false', 'null']),
  yaml: new Set(['true', 'false', 'null', 'yes', 'no']),
  css: new Set(['important', 'media', 'import', 'keyframes', 'supports', 'from', 'to']),
};

/**
 * Comment syntax per language family: the line token and the block pair.
 */
const COMMENTS: Record<Language, { line: string | null; block: [string, string] | null }> = {
  cfamily: { line: '//', block: ['/*', '*/'] },
  java: { line: '//', block: ['/*', '*/'] },
  go: { line: '//', block: ['/*', '*/'] },
  css: { line: null, block: ['/*', '*/'] },
  python: { line: '#', block: null },
  shell: { line: '#', block: null },
  yaml: { line: '#', block: null },
  json: { line: null, block: null },
};

/**
 * File extensions mapped to the language family used to highlight them.
 */
const EXTENSIONS: Record<string, Language> = {
  js: 'cfamily', jsx: 'cfamily', mjs: 'cfamily', cjs: 'cfamily', ts: 'cfamily', tsx: 'cfamily',
  c: 'cfamily', h: 'cfamily', cc: 'cfamily', cpp: 'cfamily', hpp: 'cfamily', cs: 'cfamily',
  swift: 'cfamily', kt: 'cfamily', kts: 'cfamily', rs: 'cfamily', php: 'cfamily',
  scala: 'cfamily', groovy: 'cfamily',
  java: 'java',
  go: 'go',
  py: 'python', pyi: 'python',
  sh: 'shell', bash: 'shell', zsh: 'shell', bzl: 'shell',
  json: 'json', jsonc: 'json',
  yml: 'yaml', yaml: 'yaml', toml: 'yaml', ini: 'yaml', cfg: 'yaml', conf: 'yaml', env: 'yaml',
  css: 'css', scss: 'css', less: 'css',
};

/**
 * Pick the language family to highlight a file with.
 *
 * @param path - Repository-relative file path.
 * @returns A language family, or null to render the file as plain text.
 */
export function languageFor(path: string): Language | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(path);
  const ext = match ? (match[1] ?? '').toLowerCase() : '';
  return EXTENSIONS[ext] ?? null;
}

/**
 * Wrap text in a token span, escaping it on the way.
 *
 * @param cls - Short token class suffix: `c`, `s`, `n` or `k`.
 * @param text - Raw token text.
 * @returns The span markup.
 */
function span(cls: string, text: string): string {
  return `<span class="sofa-t-${cls}">${escapeHtml(text)}</span>`;
}

/**
 * Read a quoted string starting at `start`, honouring backslash escapes.
 *
 * An unterminated string ends at the end of the line, which is the right
 * behaviour for a line-oriented renderer.
 *
 * @param text - The full line.
 * @param start - Index of the opening quote.
 * @returns Markup for the string and the index just after it.
 */
function readString(text: string, start: number): { html: string; next: number } {
  const quote = text.charAt(start);
  let index = start + 1;
  while (index < text.length) {
    const ch = text.charAt(index);
    if (ch === '\\') {
      index += 2;
      continue;
    }
    index++;
    if (ch === quote) break;
  }
  return { html: span('s', text.slice(start, index)), next: index };
}

/**
 * Highlight one line of source code.
 *
 * @param text - The line's raw text.
 * @param lang - Language family, or null for plain text.
 * @param state - Mutable state carried across the lines of one file.
 * @returns HTML-safe markup for the line.
 */
export function highlightLine(text: string, lang: Language | null, state: HighlightState): string {
  if (!lang) return escapeHtml(text);
  const keywords = KEYWORDS[lang];
  const comments = COMMENTS[lang];
  let out = '';
  let i = 0;

  while (i < text.length) {
    if (state.block && comments.block) {
      const closer = comments.block[1];
      const end = text.indexOf(closer, i);
      if (end === -1) {
        out += span('c', text.slice(i));
        i = text.length;
      } else {
        out += span('c', text.slice(i, end + closer.length));
        i = end + closer.length;
        state.block = false;
      }
      continue;
    }

    const ch = text.charAt(i);
    if (comments.block && text.startsWith(comments.block[0], i)) {
      state.block = true;
      out += span('c', comments.block[0]);
      i += comments.block[0].length;
      continue;
    }
    if (comments.line && text.startsWith(comments.line, i)) {
      out += span('c', text.slice(i));
      break;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const read = readString(text, i);
      out += read.html;
      i = read.next;
      continue;
    }
    if (ch >= '0' && ch <= '9' && !/[\w$]/.test(text.charAt(i - 1) || '')) {
      const number = /^(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
      const token = number ? number[0] : ch;
      out += span('n', token);
      i += token.length;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const word = (/^[\w$]+/.exec(text.slice(i)) ?? [ch])[0];
      out += keywords.has(word) ? span('k', word) : escapeHtml(word);
      i += word.length;
      continue;
    }
    out += escapeHtml(ch);
    i++;
  }

  return out;
}

/**
 * Create the state object a run of `highlightLine` calls shares.
 *
 * @returns Fresh state with no block comment open.
 */
export function newHighlightState(): HighlightState {
  return { block: false };
}
