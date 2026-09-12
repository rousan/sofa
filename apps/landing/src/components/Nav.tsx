/**
 * The bar at the top of every page.
 */
import { InstallButton } from './InstallButton.tsx';
import { GitHubIcon } from './icons.tsx';
import { LINKS } from '../content.ts';

/**
 * Render the navigation bar.
 *
 * @returns The header element.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-edge/70 bg-canvas/85 backdrop-blur">
      <nav className="mx-auto flex max-w-[1120px] items-center gap-3 px-5 py-2.5">
        <a href="/" className="flex items-center gap-1.5 font-semibold">
          <img src="/icon.png" alt="" width={18} height={18} className="rounded" />
          Sofa
        </a>
        <span className="text-ink-faint">Chrome extension</span>
        <a href={LINKS.repo} className="ml-auto hidden items-center gap-1.5 text-ink-soft transition hover:text-ink sm:flex">
          <GitHubIcon className="h-3.5 w-3.5" />
          GitHub
        </a>
        <span className="ml-auto sm:ml-4">
          <InstallButton />
        </span>
      </nav>
    </header>
  );
}
