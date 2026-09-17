/**
 * One host: whether Sofa can read from it, and the token that decides that.
 */
import { useState } from 'react';
import type { HostEntry } from './useHosts.ts';

/**
 * Where a fine-grained token is created.
 *
 * The path is the same on github.com and on every GitHub Enterprise host, so
 * only the hostname changes.
 *
 * @param host - The host the token is for.
 * @returns The URL of that host's token page.
 */
function tokenPageFor(host: string): string {
  return `https://${host}/settings/personal-access-tokens/new`;
}

/**
 * The colour of a host's status dot.
 *
 * Green means Sofa can read from the host, red means it cannot, and a faint dot
 * means the answer is still in flight. This is the only colour in the list, so
 * the row can be read at a glance without any text.
 *
 * @param state - The host's token state.
 * @returns A Tailwind background class.
 */
function dotClass(state: HostEntry['token']): string {
  if (state.status === 'ok') return 'bg-ok';
  if (state.status === 'checking') return 'bg-ink-faint/40';
  return 'bg-bad';
}

/**
 * The one-line summary under the hostname.
 *
 * @param props - The token state to describe.
 * @returns The status text.
 */
function statusText(state: HostEntry['token']): string {
  if (state.status === 'checking') return 'checking';
  if (state.status === 'ok') return state.login;
  if (state.status === 'bad') return `token ${state.reason}`;
  return 'no token';
}

/**
 * Props for `HostRow`.
 */
interface HostRowProps {
  /** The host being shown. */
  entry: HostEntry;
  /** Store or clear this host's token. */
  onSaveToken: (host: string, token: string) => Promise<void>;
  /** Give back this host's permission. */
  onRemove: (entry: HostEntry) => Promise<void>;
}

/**
 * Render one host.
 *
 * @param props - The host, and the two things that can be done to it.
 * @returns The row.
 */
export function HostRow({ entry, onSaveToken, onRemove }: HostRowProps) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const connected = entry.token.status === 'ok';

  return (
    <li className="border-b border-edge px-3.5 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 shrink-0 rounded-full ${dotClass(entry.token)}`} aria-hidden="true" />
        <span className="truncate font-mono text-[12px]">{entry.host}</span>
        {!entry.builtIn && (
          <button
            type="button"
            onClick={() => void onRemove(entry)}
            className="ml-auto shrink-0 text-[11px] text-ink-faint transition hover:text-ink"
          >
            Remove
          </button>
        )}
      </div>

      <p className="mt-0.5 pl-3.5 text-[11px] text-ink-faint">{statusText(entry.token)}</p>

      {(!connected || editing) && (
        <form
          className="mt-2 flex gap-1.5 pl-3.5"
          onSubmit={async (event) => {
            event.preventDefault();
            await onSaveToken(entry.host, value);
            setValue('');
            setEditing(false);
          }}
        >
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="paste a token"
            aria-label={`Token for ${entry.host}`}
            className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 font-mono text-[11px] outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white transition hover:opacity-90"
          >
            Save
          </button>
        </form>
      )}

      <div className="mt-1.5 flex gap-3 pl-3.5 text-[11px] text-ink-faint">
        {connected && !editing && (
          <>
            <button type="button" className="transition hover:text-ink" onClick={() => setEditing(true)}>
              Replace
            </button>
            <button
              type="button"
              className="transition hover:text-ink"
              onClick={() => void onSaveToken(entry.host, '')}
            >
              Forget
            </button>
          </>
        )}
        {!connected && (
          <a
            href={tokenPageFor(entry.host)}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-ink"
          >
            Create a token &rarr;
          </a>
        )}
      </div>
    </li>
  );
}
