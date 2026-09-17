/**
 * Tests for the comment Markdown renderer.
 *
 * The escaping cases matter more than the formatting ones: this output is
 * inserted into GitHub's own page, so anything that lets markup through is a
 * script-injection bug rather than a cosmetic one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/markdown.ts';

test('renders paragraphs, keeping single newlines as breaks', () => {
  assert.equal(renderMarkdown('one\ntwo'), '<p>one<br />two</p>');
  assert.equal(renderMarkdown('one\n\ntwo'), '<p>one</p><p>two</p>');
});

test('escapes HTML in the source', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('escapes HTML inside code, without double-escaping it', () => {
  assert.equal(renderMarkdown('`<b>`'), '<p><code>&lt;b&gt;</code></p>');
});

test('renders fenced code with its language, and does not format inside it', () => {
  const html = renderMarkdown('```ts\nconst a = **b**;\n```');
  assert.equal(html, '<pre data-language="ts"><code>const a = **b**;</code></pre>');
});

test('leaves an unterminated fence as code to the end', () => {
  const html = renderMarkdown('```\nunclosed');
  assert.ok(html.startsWith('<pre><code>unclosed'));
});

test('renders emphasis, strong and strikethrough', () => {
  assert.equal(renderMarkdown('*a* **b** ~~c~~'), '<p><em>a</em> <strong>b</strong> <del>c</del></p>');
});

test('leaves underscores inside a word alone', () => {
  assert.equal(renderMarkdown('call snake_case_name here'), '<p>call snake_case_name here</p>');
});

test('renders links and bare URLs', () => {
  assert.equal(
    renderMarkdown('[docs](https://example.com/a)'),
    '<p><a href="https://example.com/a" target="_blank" rel="noreferrer noopener">docs</a></p>',
  );
  assert.ok(renderMarkdown('see https://example.com/a for more').includes('href="https://example.com/a"'));
});

test('refuses a link whose scheme is not http, https or mailto', () => {
  const html = renderMarkdown('[click](javascript:alert(1))');
  assert.ok(!html.includes('<a '));
  assert.ok(html.includes('[click]'));
});

test('renders an image as a link rather than fetching it', () => {
  const html = renderMarkdown('![shot](https://example.com/a.png)');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('>shot</a>'));
});

test('renders unordered and ordered lists', () => {
  assert.equal(renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
});

test('nests a list inside the item above it', () => {
  assert.equal(
    renderMarkdown('- a\n  - b\n- c'),
    '<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>',
  );
});

test('renders a task list as disabled checkboxes', () => {
  const html = renderMarkdown('- [x] done\n- [ ] todo');
  assert.ok(html.includes('<input type="checkbox" disabled checked /> done'));
  assert.ok(html.includes('<input type="checkbox" disabled /> todo'));
});

test('renders blockquotes and headings', () => {
  assert.equal(renderMarkdown('> quoted'), '<blockquote><p>quoted</p></blockquote>');
  assert.equal(renderMarkdown('# Title'), '<h3>Title</h3>');
});

test('cannot be tricked by a placeholder written in the comment', () => {
  // The renderer swaps code and links out for internal markers while it works.
  // A comment containing text that looks like one must come back unchanged.
  const html = renderMarkdown('literally L0 and C0 and F0 here');
  assert.ok(html.includes('literally L0 and C0 and F0 here'));
});

test('returns nothing for an empty body', () => {
  assert.equal(renderMarkdown(''), '');
});
