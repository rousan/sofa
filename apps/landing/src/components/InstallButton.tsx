/**
 * The call to action, in both its sizes.
 */
import { ChromeIcon } from './icons.tsx';
import { LINKS } from '../content.ts';

/**
 * Props for `InstallButton`.
 */
interface InstallButtonProps {
  /** `lg` for the hero, `md` for the nav and the closing band. */
  size?: 'md' | 'lg';
}

/**
 * Render the install button.
 *
 * It points at the Chrome Web Store when there is a listing, and at the
 * repository until then, so the page never offers a link that does not work.
 *
 * @param props - The size to render at.
 * @returns The anchor.
 */
export function InstallButton({ size = 'md' }: InstallButtonProps) {
  const large = size === 'lg';
  return (
    <a
      href={LINKS.store ?? LINKS.repo}
      className={[
        'group inline-flex items-center gap-2.5 rounded-xl bg-brand font-semibold text-white',
        'shadow-lg shadow-brand/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30',
        large ? 'px-7 py-3.5 text-base' : 'px-4 py-2 text-sm',
      ].join(' ')}
    >
      <ChromeIcon className={large ? 'h-5 w-5' : 'h-4 w-4'} />
      {LINKS.store ? 'Add to Chrome' : 'Get Sofa'}
      {large && <span className="text-white/70">— it&rsquo;s free</span>}
    </a>
  );
}
