/**
 * Entry point: puts the Sofa tab next to "Files changed" and opens the panel.
 *
 * GitHub navigates without full page loads, so the tab is re-injected whenever
 * the DOM settles on a new pull request view rather than only once at load.
 */
import { debounce } from './util.ts';
import { parseLocation } from './github.ts';
import { closePanel, isPanelOpen, openPanel } from './ui/panel.ts';
import type { PrContext } from './types.ts';

/**
 * Attribute marking a tab this script injected, so it is never added twice.
 */
const TAB_FLAG = 'data-sofa-tab';

/**
 * Hash that keeps the panel open across a reload of the same pull request.
 */
const OPEN_HASH = '#sofa';

/**
 * The couch glyph in the tab, drawn to match the size of GitHub's tab icons.
 */
const ICON = '<svg class="sofa-tab-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">'
  + '<path fill="currentColor" d="M3 6.6V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.6a1.75 1.75 0 0 1 1.5 1.73V12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 .5 12V8.33A1.75 1.75 0 0 1 2 6.6Zm1.5-.1h7V5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5v1.5Zm-2.25 1.5a.25.25 0 0 0-.25.25V12h12V8.25a.25.25 0 0 0-.25-.25H2.25Z"/>'
  + '</svg>';

/**
 * The URL the injector last reconciled, so repeated mutations stay cheap.
 */
let lastUrl = '';

/**
 * The class names GitHub adds to whichever tab is selected, worked out by
 * diffing the selected tab's classes against an unselected one. Copying them
 * is what makes the Sofa tab look selected exactly like a native tab does,
 * whatever markup the forge version uses.
 */
let selectedClasses: string[] = [];

/**
 * The native tab that was selected before Sofa took over, so its own selected
 * styling can be put back when Sofa closes.
 */
let deselected: Element | null = null;

/**
 * Every tab anchor in the pull request's tab bar.
 *
 * @param filesTab - The "Files changed" anchor, used to locate the bar.
 * @returns The tab anchors, in document order.
 */
function tabAnchors(filesTab: HTMLAnchorElement): HTMLAnchorElement[] {
  const bar = filesTab.closest('nav, [role="tablist"], .tabnav-tabs');
  if (!bar) return [filesTab];
  return [...bar.querySelectorAll<HTMLAnchorElement>('a[href]')];
}

/**
 * Work out how GitHub styles a selected tab in this page's markup.
 *
 * @param filesTab - The "Files changed" anchor.
 * @returns The unselected class list to build the Sofa tab from, and the extra
 *   classes that mark a tab as selected.
 */
function readTabStyling(filesTab: HTMLAnchorElement): { base: string; selected: string[] } {
  const anchors = tabAnchors(filesTab);
  const active = anchors.find((a) => a.getAttribute('aria-current') || a.classList.contains('selected')) ?? filesTab;
  const inactive = anchors.find((a) => a !== active);
  if (!inactive) return { base: filesTab.className, selected: [] };
  const inactiveClasses = new Set(inactive.classList);
  return {
    base: inactive.className,
    selected: [...active.classList].filter((name) => !inactiveClasses.has(name)),
  };
}

/**
 * Move the native selected styling onto, or off, the Sofa tab.
 *
 * @param isActive - Whether Sofa is the tab being shown.
 */
function setNativeSelection(isActive: boolean): void {
  const tab = document.querySelector(`[${TAB_FLAG}]`);
  if (!tab) return;
  if (isActive) {
    const current = tabAnchors(tab as HTMLAnchorElement)
      .find((a) => a !== tab && (a.getAttribute('aria-current') || a.classList.contains('selected')));
    if (current) {
      deselected = current;
      current.classList.remove(...selectedClasses);
      current.removeAttribute('aria-current');
    }
    tab.classList.add(...selectedClasses);
    tab.setAttribute('aria-current', 'page');
    return;
  }
  tab.classList.remove(...selectedClasses);
  tab.removeAttribute('aria-current');
  if (deselected) {
    deselected.classList.add(...selectedClasses);
    deselected.setAttribute('aria-current', 'page');
    deselected = null;
  }
}

/**
 * Update the count shown in the Sofa tab, matching GitHub's tab counters.
 *
 * @param count - Number of changed files in the pull request.
 */
function setTabCount(count: number): void {
  const counter = document.querySelector<HTMLElement>(`[${TAB_FLAG}] .sofa-tab-count`);
  if (!counter) return;
  counter.textContent = String(count);
  counter.hidden = false;
}

/**
 * Match the "Files changed" tab's href.
 *
 * Two spellings are in the wild: the long-standing `/files`, and `/changes` in
 * the newer review experience GitHub is rolling out. A page only ever carries
 * one of them, and Enterprise is still on the first.
 *
 * @param ctx - The pull request being viewed.
 * @returns A pattern matching that tab's href, with or without a query.
 */
function filesTabPattern(ctx: PrContext): RegExp {
  return new RegExp(`/${ctx.owner}/${ctx.repo}/pull/${ctx.number}/(?:files|changes)(?:[?#]|$)`);
}

/**
 * Find the pull request's "Files changed" tab.
 *
 * Matching on the href rather than a class keeps this working across the
 * different tab markup github.com and Enterprise releases ship.
 *
 * @param ctx - The pull request being viewed.
 * @returns The anchor, or null when the tab nav is not on the page.
 */
function findFilesTab(ctx: PrContext): HTMLAnchorElement | null {
  const pattern = filesTabPattern(ctx);
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (!pattern.test(anchor.getAttribute('href') ?? '')) continue;
    // A tab lives inside a nav or a tablist; a link in the page body does not.
    if (anchor.closest('nav, [role="tablist"], .tabnav-tabs')) return anchor;
  }
  return null;
}

/**
 * Mark the Sofa tab active or inactive.
 *
 * The selected styling is handed over from whichever native tab holds it, and
 * handed straight back on close, so the tab bar always shows exactly one
 * selected tab and GitHub's own navigation keeps working.
 *
 * @param isActive - Whether the panel is open.
 */
function setTabActive(isActive: boolean): void {
  document.querySelector(`[${TAB_FLAG}]`)?.classList.toggle('is-active', isActive);
  setNativeSelection(isActive);
}

/**
 * Open the Sofa panel and reflect that in the tab and the URL hash.
 *
 * @param ctx - The pull request being viewed.
 */
function open(ctx: PrContext): void {
  const filesTab = findFilesTab(ctx);
  openPanel(ctx, {
    // The tab bar doubles as the anchor: the panel replaces whatever GitHub
    // renders below it, which is what makes Sofa act like a native tab.
    anchor: filesTab,
    findAnchor: () => findFilesTab(ctx),
    onFileCount: setTabCount,
    onClose: () => {
      setTabActive(false);
      if (window.location.hash === OPEN_HASH) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    },
  });
  setTabActive(true);
  if (window.location.hash !== OPEN_HASH) {
    history.replaceState(null, '', window.location.pathname + window.location.search + OPEN_HASH);
  }
}

/**
 * Insert the Sofa tab after "Files changed", unless it is already there.
 *
 * @param ctx - The pull request being viewed.
 * @returns The tab element, or null when the nav was not found.
 */
function ensureTab(ctx: PrContext): Element | null {
  const existing = document.querySelector(`[${TAB_FLAG}]`);
  if (existing) return existing;

  const filesTab = findFilesTab(ctx);
  if (!filesTab) return null;

  const styling = readTabStyling(filesTab);
  selectedClasses = styling.selected;

  const tab = document.createElement('a');
  // Built from an unselected tab's classes, so it does not start out looking
  // like the open tab; the selected classes are applied only while Sofa is open.
  tab.className = `${styling.base} sofa-tab`;
  tab.setAttribute(TAB_FLAG, '1');
  tab.setAttribute('href', OPEN_HASH);
  tab.setAttribute('role', filesTab.getAttribute('role') ?? 'tab');
  const counterClass = filesTab.querySelector('.Counter')?.className ?? 'Counter';
  tab.innerHTML = `${ICON}<span class="sofa-tab-label">Sofa</span>`
    + `<span class="${counterClass} sofa-tab-count" hidden></span>`;
  tab.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    open(ctx);
  });

  // Enterprise builds wrap each tab in a list item; match whichever is in use.
  const filesItem = filesTab.closest('li');
  if (filesItem?.parentElement) {
    const item = document.createElement('li');
    item.className = filesItem.className;
    item.appendChild(tab);
    filesItem.parentElement.insertBefore(item, filesItem.nextSibling);
    return tab;
  }
  if (filesTab.parentElement) {
    filesTab.parentElement.insertBefore(tab, filesTab.nextSibling);
    return tab;
  }
  return null;
}

/**
 * Reconcile the tab and the panel with the URL the browser is showing.
 */
function sync(): void {
  const ctx = parseLocation();
  if (!ctx) {
    const stray = document.querySelector(`[${TAB_FLAG}]`);
    (stray?.closest('li') ?? stray)?.remove();
    if (isPanelOpen()) closePanel();
    lastUrl = window.location.href;
    return;
  }

  if (!ensureTab(ctx)) return;

  const urlChanged = lastUrl !== window.location.href;
  lastUrl = window.location.href;
  if (window.location.hash === OPEN_HASH && !isPanelOpen()) open(ctx);
  else if (urlChanged && window.location.hash !== OPEN_HASH && isPanelOpen()) closePanel();
  else setTabActive(isPanelOpen());
}

const scheduleSync = debounce(sync, 150);

/**
 * Start watching the page for the navigation GitHub performs.
 *
 * A mutation observer backs up the named events, because which of them fire
 * depends on the forge version and on whether Turbo is enabled.
 */
function start(): void {
  sync();
  for (const name of ['turbo:load', 'turbo:render', 'pjax:end', 'soft-nav:end', 'popstate', 'hashchange']) {
    window.addEventListener(name, scheduleSync);
  }
  new MutationObserver(() => {
    if (lastUrl !== window.location.href || !document.querySelector(`[${TAB_FLAG}]`)) scheduleSync();
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
