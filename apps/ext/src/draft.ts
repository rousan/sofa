/**
 * The review a reviewer is part-way through writing.
 *
 * GitHub keeps a pending review on its own server, so its drafts follow you
 * between machines. Sofa cannot: the REST API can create a review with all of
 * its comments at once, and it can submit one, but it has no way to add a
 * comment to a review that is already pending. So the draft is held here until
 * it is submitted, and the whole review goes up in a single call.
 *
 * The practical differences are worth knowing. A draft written in Sofa is not
 * visible in GitHub's own Files changed tab until it is submitted, and it lives
 * in this browser profile rather than in the account.
 */
import type { DiffSide } from '@sofa/core';
import type { PrContext } from '@sofa/core';

/**
 * One comment waiting to be submitted with the review.
 */
export interface DraftComment {
  /** A local id, so a comment can be edited or dropped before it is sent. */
  id: string;
  /** Repository-relative path of the file. */
  path: string;
  /** The line the comment is against. */
  line: number;
  /** Which side of the diff that line is on. */
  side: DiffSide;
  /** What the reviewer wrote. */
  body: string;
}

/**
 * A pull request's unsubmitted review.
 */
export interface ReviewDraft {
  /** The pending line comments, in the order they were written. */
  comments: DraftComment[];
  /** The summary the reviewer has typed into the finish dialog, if any. */
  summary: string;
}

/**
 * An empty draft, used whenever storage holds nothing for a pull request.
 */
const EMPTY: ReviewDraft = { comments: [], summary: '' };

/**
 * The storage key for one pull request's draft.
 *
 * The host is part of the key because the same owner, repository and number can
 * exist on github.com and on a company forge and mean different things.
 *
 * @param ctx - The pull request being reviewed.
 * @returns A key unique to that pull request.
 */
function keyFor(ctx: PrContext): string {
  const host = (() => {
    try {
      return new URL(ctx.origin).hostname;
    } catch {
      return ctx.origin;
    }
  })();
  return `sofa:draft:${host}/${ctx.owner}/${ctx.repo}/${ctx.number}`;
}

/**
 * Whether extension storage is available.
 *
 * The offline harness runs the same UI with no extension around it, and a draft
 * that cannot be saved is better than a panel that will not render.
 *
 * @returns True when `chrome.storage.local` can be used.
 */
function hasStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local);
}

/**
 * Read a pull request's draft.
 *
 * @param ctx - The pull request being reviewed.
 * @returns The draft, or an empty one when nothing is stored.
 */
export async function loadDraft(ctx: PrContext): Promise<ReviewDraft> {
  if (!hasStorage()) return { ...EMPTY, comments: [] };
  const key = keyFor(ctx);
  try {
    const stored = (await chrome.storage.local.get(key))[key] as Partial<ReviewDraft> | undefined;
    return {
      comments: Array.isArray(stored?.comments) ? stored.comments : [],
      summary: typeof stored?.summary === 'string' ? stored.summary : '',
    };
  } catch {
    return { ...EMPTY, comments: [] };
  }
}

/**
 * Write a pull request's draft back.
 *
 * A draft with nothing in it is removed rather than stored, so a profile does
 * not accumulate an entry for every pull request ever opened.
 *
 * @param ctx - The pull request being reviewed.
 * @param draft - The draft to store.
 */
export async function saveDraft(ctx: PrContext, draft: ReviewDraft): Promise<void> {
  if (!hasStorage()) return;
  const key = keyFor(ctx);
  try {
    if (draft.comments.length === 0 && draft.summary.trim() === '') {
      await chrome.storage.local.remove(key);
      return;
    }
    await chrome.storage.local.set({ [key]: draft });
  } catch {
    // A full or unavailable storage must not stop someone reviewing; the draft
    // simply stays in memory for this page.
  }
}

/**
 * Forget a pull request's draft, once its review has been submitted.
 *
 * @param ctx - The pull request being reviewed.
 */
export async function clearDraft(ctx: PrContext): Promise<void> {
  if (!hasStorage()) return;
  try {
    await chrome.storage.local.remove(keyFor(ctx));
  } catch {
    // Nothing to do: a stale draft is recoverable, a thrown error here is not.
  }
}

/**
 * Make an id for a new draft comment.
 *
 * @returns An id unique within this page's lifetime.
 */
export function draftId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
