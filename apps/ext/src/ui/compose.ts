/**
 * The comment box: Write and Preview tabs, a formatting toolbar, and whatever
 * buttons the caller needs under it.
 *
 * It is the same component in all three places a reviewer writes something - a
 * new comment on a line, a reply in a thread, and the summary in the finish
 * dialog - because on GitHub those are the same box with different buttons.
 * Only the actions differ, so only the actions are passed in.
 */
import { renderMarkdown } from '@sofa/core';
import { el } from '../util.ts';

/**
 * One button under the box.
 */
export interface ComposeAction {
  /** The button's label. */
  label: string;
  /** Green and filled, the way GitHub marks the action it expects. */
  primary?: boolean;
  /** Greyed out until something has been typed. */
  needsBody?: boolean;
  /**
   * Run the action.
   *
   * @param body - What is in the box.
   * @returns An error to show, or null when it worked.
   */
  run: (body: string) => Promise<string | null>;
}

/**
 * How to build one comment box.
 */
export interface ComposeOptions {
  /** Placeholder for the textarea. */
  placeholder?: string;
  /** Text to start with, for an edited draft. */
  value?: string;
  /** The buttons, in the order GitHub puts them: least committal first. */
  actions: ComposeAction[];
  /** Called when Cancel is pressed; omitting it hides the Cancel button. */
  onCancel?: () => void;
  /** Called whenever the text changes, for a caller that persists a draft. */
  onInput?: (value: string) => void;
  /**
   * Where to put the buttons, when they do not belong directly under the box.
   *
   * The finish dialog needs them below its radio buttons, in a footer of its
   * own, which is where GitHub puts Submit review.
   */
  actionsInto?: HTMLElement;
}

/**
 * What the caller keeps hold of.
 */
export interface ComposeHandle {
  /** The box itself, to place in the page. */
  element: HTMLElement;
  /** Put the cursor in the textarea. */
  focus: () => void;
  /** What has been typed. */
  value: () => string;
  /** Show a message under the buttons, such as a failed post. */
  setError: (message: string | null) => void;
}

/**
 * The toolbar buttons, in GitHub's order.
 *
 * `text` renders a letterform the way GitHub draws H, B, I and the code button;
 * `svg` is for the ones that are shapes. Each carries what it wraps the
 * selection in, or the prefix it puts on each selected line.
 */
const TOOLS: {
  name: string;
  title: string;
  text?: string;
  textClass?: string;
  svg?: string;
  wrap?: [string, string];
  prefix?: string;
}[] = [
  { name: 'heading', title: 'Heading', text: 'H', textClass: 'sofa-tool-letter', prefix: '### ' },
  { name: 'bold', title: 'Bold', text: 'B', textClass: 'sofa-tool-letter sofa-tool-bold', wrap: ['**', '**'] },
  { name: 'italic', title: 'Italic', text: 'I', textClass: 'sofa-tool-letter sofa-tool-italic', wrap: ['_', '_'] },
  {
    name: 'quote',
    title: 'Quote',
    svg: '<rect x="1.5" y="2.5" width="1.6" height="11" rx="0.8"></rect>'
      + '<rect x="5" y="3" width="9.5" height="1.5" rx="0.75"></rect>'
      + '<rect x="5" y="7.25" width="9.5" height="1.5" rx="0.75"></rect>'
      + '<rect x="5" y="11.5" width="6.5" height="1.5" rx="0.75"></rect>',
    prefix: '> ',
  },
  { name: 'code', title: 'Code', text: '<>', textClass: 'sofa-tool-letter sofa-tool-code', wrap: ['`', '`'] },
  {
    name: 'link',
    title: 'Link',
    svg: '<path d="M6.2 9.8a2.9 2.9 0 0 0 4.1 0l2.2-2.2a2.9 2.9 0 1 0-4.1-4.1l-1 1" '
      + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>'
      + '<path d="M9.8 6.2a2.9 2.9 0 0 0-4.1 0L3.5 8.4a2.9 2.9 0 1 0 4.1 4.1l1-1" '
      + 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>',
    wrap: ['[', '](url)'],
  },
  {
    name: 'ordered',
    title: 'Numbered list',
    svg: '<text x="0.6" y="6" font-size="5.5" fill="currentColor">1</text>'
      + '<text x="0.6" y="14" font-size="5.5" fill="currentColor">2</text>'
      + '<rect x="5.5" y="3.25" width="9" height="1.5" rx="0.75"></rect>'
      + '<rect x="5.5" y="11.25" width="9" height="1.5" rx="0.75"></rect>',
    prefix: '1. ',
  },
  {
    name: 'unordered',
    title: 'Bulleted list',
    svg: '<circle cx="2.2" cy="4" r="1.35"></circle>'
      + '<circle cx="2.2" cy="8" r="1.35"></circle>'
      + '<circle cx="2.2" cy="12" r="1.35"></circle>'
      + '<rect x="5.5" y="3.25" width="9" height="1.5" rx="0.75"></rect>'
      + '<rect x="5.5" y="7.25" width="9" height="1.5" rx="0.75"></rect>'
      + '<rect x="5.5" y="11.25" width="9" height="1.5" rx="0.75"></rect>',
    prefix: '- ',
  },
  {
    name: 'task',
    title: 'Task list',
    svg: '<rect x="0.9" y="2.4" width="3.4" height="3.4" rx="1" fill="none" '
      + 'stroke="currentColor" stroke-width="1.2"></rect>'
      + '<path d="M1.5 10.6l1.1 1.1 2-2.2" fill="none" stroke="currentColor" '
      + 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>'
      + '<rect x="6.2" y="3.35" width="8.3" height="1.5" rx="0.75"></rect>'
      + '<rect x="6.2" y="10.35" width="8.3" height="1.5" rx="0.75"></rect>',
    prefix: '- [ ] ',
  },
];

/**
 * Apply one toolbar tool to the textarea's current selection.
 *
 * Wrapping tools surround the selection and leave it selected, so pressing
 * bold twice in a row is not destructive. Prefixing tools put their marker on
 * every selected line, which is what makes a list out of several lines at once.
 *
 * @param field - The textarea being edited.
 * @param tool - The tool that was pressed.
 */
function applyTool(field: HTMLTextAreaElement, tool: (typeof TOOLS)[number]): void {
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const selected = field.value.slice(start, end);

  if (tool.wrap) {
    const [before, after] = tool.wrap;
    field.setRangeText(`${before}${selected}${after}`, start, end, 'end');
    // With nothing selected, drop the cursor between the markers so typing
    // lands inside them rather than after.
    if (!selected) {
      const caret = start + before.length;
      field.setSelectionRange(caret, caret);
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    return;
  }

  if (!tool.prefix) return;

  // Grow the selection to whole lines, so a prefix always starts at a margin.
  const lineStart = field.value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = field.value.indexOf('\n', end);
  const to = lineEnd === -1 ? field.value.length : lineEnd;
  const block = field.value.slice(lineStart, to);
  const prefixed = block
    .split('\n')
    .map((line, index) => {
      // A numbered list counts up; everything else repeats the same marker.
      const marker = tool.prefix === '1. ' ? `${index + 1}. ` : tool.prefix;
      return `${marker}${line}`;
    })
    .join('\n');

  field.setRangeText(prefixed, lineStart, to, 'end');
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.focus();
}

/**
 * Build a comment box.
 *
 * @param options - Placeholder, starting text, buttons and callbacks.
 * @returns The box, and the handful of things a caller does to it.
 */
export function createCompose(options: ComposeOptions): ComposeHandle {
  const field = el('textarea', {
    className: 'sofa-compose-field',
    attrs: { placeholder: options.placeholder ?? 'Leave a comment', rows: '4' },
  });
  field.value = options.value ?? '';

  const preview = el('div', { className: 'sofa-compose-preview', attrs: { hidden: 'hidden' } });
  const error = el('p', { className: 'sofa-compose-error', attrs: { hidden: 'hidden' } });

  const writeTab = el('button', {
    className: 'sofa-compose-tab sofa-compose-tab--on',
    text: 'Write',
    attrs: { type: 'button' },
  });
  const previewTab = el('button', {
    className: 'sofa-compose-tab',
    text: 'Preview',
    attrs: { type: 'button' },
  });

  /**
   * Switch between writing and previewing.
   *
   * @param showing - True to show the rendered preview.
   */
  function setPreview(showing: boolean): void {
    writeTab.classList.toggle('sofa-compose-tab--on', !showing);
    previewTab.classList.toggle('sofa-compose-tab--on', showing);
    field.hidden = showing;
    preview.hidden = !showing;
    if (showing) {
      const body = field.value.trim();
      preview.innerHTML = body ? renderMarkdown(body) : '<p class="sofa-compose-nothing">Nothing to preview</p>';
    } else {
      field.focus();
    }
  }

  writeTab.addEventListener('click', () => setPreview(false));
  previewTab.addEventListener('click', () => setPreview(true));

  const tools = el('div', { className: 'sofa-compose-tools' });
  for (const tool of TOOLS) {
    const button = el('button', {
      className: 'sofa-compose-tool',
      attrs: { type: 'button', title: tool.title, 'aria-label': tool.title },
    });
    if (tool.text) {
      button.appendChild(el('span', { className: tool.textClass ?? '', text: tool.text }));
    } else if (tool.svg) {
      // Author-written markup, never anything from the page or the forge.
      button.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${tool.svg}</svg>`;
    }
    button.addEventListener('click', () => applyTool(field, tool));
    tools.appendChild(button);
  }

  const buttons: HTMLButtonElement[] = [];
  const actions = el('div', { className: 'sofa-compose-actions' });

  if (options.onCancel) {
    const cancel = el('button', {
      className: 'sofa-btn',
      text: 'Cancel',
      attrs: { type: 'button' },
    });
    cancel.addEventListener('click', () => options.onCancel?.());
    actions.appendChild(cancel);
  }

  /**
   * Enable or disable every button at once.
   *
   * @param busy - True while a request is in flight.
   */
  function setBusy(busy: boolean): void {
    for (const button of buttons) {
      const needsBody = button.dataset['needsBody'] === 'true';
      button.disabled = busy || (needsBody && field.value.trim() === '');
    }
  }

  for (const action of options.actions) {
    const button = el('button', {
      className: `sofa-btn${action.primary ? ' sofa-btn--go' : ''}`,
      text: action.label,
      attrs: { type: 'button' },
    });
    button.dataset['needsBody'] = action.needsBody === false ? 'false' : 'true';
    button.addEventListener('click', () => {
      setError(null);
      setBusy(true);
      void action.run(field.value.trim()).then((message) => {
        setBusy(false);
        if (message) setError(message);
      });
    });
    buttons.push(button);
    actions.appendChild(button);
  }

  /**
   * Show or clear the message under the buttons.
   *
   * @param message - What went wrong, or null to clear it.
   */
  function setError(message: string | null): void {
    error.textContent = message ?? '';
    error.hidden = !message;
  }

  field.addEventListener('input', () => {
    setBusy(false);
    options.onInput?.(field.value);
    // Grow with the text, the way GitHub's box does, up to a point where the
    // thread would start pushing the code too far apart.
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 320)}px`;
  });

  field.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      options.onCancel?.();
      return;
    }
    // The last action is the one GitHub treats as the default, and the one
    // Cmd-Enter runs.
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      buttons[buttons.length - 1]?.click();
    }
  });

  setBusy(false);

  const element = el('div', {
    className: 'sofa-compose',
    children: [
      el('div', {
        className: 'sofa-compose-head',
        children: [
          el('div', { className: 'sofa-compose-tabs', children: [writeTab, previewTab] }),
          tools,
        ],
      }),
      el('div', { className: 'sofa-compose-body', children: [field, preview] }),
      el('div', {
        className: 'sofa-compose-foot',
        children: [el('span', { className: 'sofa-compose-hint', text: 'Markdown is supported' })],
      }),
      options.actionsInto ? null : error,
      options.actionsInto ? null : actions,
    ],
  });

  if (options.actionsInto) options.actionsInto.append(error, actions);

  return {
    element,
    focus: () => field.focus(),
    value: () => field.value.trim(),
    setError,
  };
}
