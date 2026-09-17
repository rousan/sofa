/**
 * The "Finish your review" dialog.
 *
 * It is the last step of a review: a summary comment, the verdict, and the
 * button that sends the pending line comments up with it. The three choices and
 * their wording are GitHub's, because a reviewer choosing between approving and
 * requesting changes should not have to work out whether Sofa means the same
 * thing by them.
 */
import { el } from '../util.ts';
import { createCompose } from './compose.ts';
import type { ReviewEvent } from '../github.ts';

/**
 * The three ways a review can end, with the descriptions GitHub gives them.
 */
const CHOICES: { event: ReviewEvent; label: string; detail: string }[] = [
  {
    event: 'COMMENT',
    label: 'Comment',
    detail: 'Submit general feedback without explicit approval.',
  },
  {
    event: 'APPROVE',
    label: 'Approve',
    detail: 'Submit feedback and approve merging these changes.',
  },
  {
    event: 'REQUEST_CHANGES',
    label: 'Request changes',
    detail: 'Submit feedback that must be addressed before merging.',
  },
];

/**
 * How to open the dialog.
 */
export interface ReviewDialogOptions {
  /** Where to mount it, which is the panel rather than the document body. */
  host: HTMLElement;
  /** The summary already typed, so closing and reopening loses nothing. */
  summary: string;
  /** How many line comments are waiting, shown in the heading. */
  pending: number;
  /** Called as the summary is typed, so the draft can be kept. */
  onSummaryChange: (value: string) => void;
  /**
   * Send the review.
   *
   * @param event - The verdict chosen.
   * @param body - The summary comment.
   * @returns An error to show, or null when it was submitted.
   */
  onSubmit: (event: ReviewEvent, body: string) => Promise<string | null>;
}

/**
 * Open the dialog.
 *
 * @param options - Where to mount it, what it starts with, and what to do.
 * @returns A function that closes it.
 */
export function openReviewDialog(options: ReviewDialogOptions): () => void {
  let chosen: ReviewEvent = 'COMMENT';

  const footer = el('div', { className: 'sofa-review-foot' });

  const compose = createCompose({
    placeholder: 'Leave a comment',
    value: options.summary,
    onInput: options.onSummaryChange,
    actionsInto: footer,
    actions: [
      {
        label: 'Submit review',
        primary: true,
        // A review can be submitted with no summary at all, which is the normal
        // shape of an approval, so the button is never disabled for emptiness.
        needsBody: false,
        run: (body) => options.onSubmit(chosen, body),
      },
    ],
  });

  const choices = el('div', { className: 'sofa-review-choices' });
  const name = `sofa-review-${Date.now()}`;
  for (const choice of CHOICES) {
    const input = el('input', {
      attrs: { type: 'radio', name, value: choice.event },
    });
    input.checked = choice.event === chosen;
    input.addEventListener('change', () => {
      if (input.checked) chosen = choice.event;
    });
    choices.appendChild(el('label', {
      className: 'sofa-review-choice',
      children: [
        input,
        el('span', {
          className: 'sofa-review-choice-text',
          children: [
            el('span', { className: 'sofa-review-choice-label', text: choice.label }),
            el('span', { className: 'sofa-review-choice-detail', text: choice.detail }),
          ],
        }),
      ],
    }));
  }

  const close = el('button', {
    className: 'sofa-review-close',
    text: '×',
    attrs: { type: 'button', 'aria-label': 'Close' },
  });

  const heading = options.pending === 0
    ? 'Finish your review'
    : `Finish your review (${options.pending} pending)`;

  const dialog = el('div', {
    className: 'sofa-review-dialog',
    attrs: { role: 'dialog', 'aria-label': 'Finish your review' },
    children: [
      el('div', {
        className: 'sofa-review-head',
        children: [el('h2', { className: 'sofa-review-title', text: heading }), close],
      }),
      el('div', { className: 'sofa-review-body', children: [compose.element, choices] }),
      footer,
    ],
  });

  const overlay = el('div', { className: 'sofa-review-overlay', children: [dialog] });

  /**
   * Take the dialog down and stop listening for the keys that close it.
   */
  function dismiss(): void {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
  }

  /**
   * Close on Escape, wherever focus happens to be.
   *
   * @param event - The keyboard event.
   */
  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
    }
  }

  close.addEventListener('click', dismiss);
  // Clicking the backdrop closes it; clicking inside must not.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) dismiss();
  });
  document.addEventListener('keydown', onKey, true);

  options.host.appendChild(overlay);
  compose.focus();
  return dismiss;
}
