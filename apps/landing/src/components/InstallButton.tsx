/**
 * The one thing the page asks for.
 */
import { ChromeIcon } from './icons.tsx';
import { HERO, LINKS } from '../content.ts';

/**
 * Props for `InstallButton`.
 */
interface InstallButtonProps {
  /** `lg` in the hero and the closing band, `sm` in the nav. */
  size?: 'sm' | 'lg';
}

/**
 * Render the install button.
 *
 * A near-black pill with the price beside it, the way a small paid app does it,
 * except the price is free. It points at the Chrome Web Store as soon as there
 * is a listing, and at the source until then, so the page never offers a link
 * that does not work.
 *
 * @param props - The size to render at.
 * @returns The anchor.
 */
export function InstallButton({ size = 'sm' }: InstallButtonProps) {
  const large = size === 'lg';
  return (
    <a
      href={LINKS.store ?? LINKS.repo}
      className={[
        'inline-flex items-center gap-2 rounded-full bg-ink font-semibold text-white transition hover:opacity-85',
        large ? 'px-4 py-2 text-[13px]' : 'px-3 py-1.5 text-[12px]',
      ].join(' ')}
    >
      <ChromeIcon className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {LINKS.store ? 'Add to Chrome' : 'Get Sofa extension'}
      <span className="text-white/55">{HERO.price}</span>
    </a>
  );
}
