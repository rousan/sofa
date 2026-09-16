/**
 * One host: whether Sofa runs there, and the token that unlocks the rest.
 */
import { useState } from 'react';
import type { HostEntry } from './useHosts.ts';

/**
 * Where a token is created, with the right permissions already chosen.
 *
 * Fine-grained tokens live at the same path on every forge, so the only thing
 * that changes is the host.
 *
 * @param host - The forge the token is for.
 * @returns The URL of that forge's token page.
 */
function tokenPageFor(host: string): string {
  return `https://${host}/settings/personal-access-tokens/new`;
}

/**
 * The status line under a host: what the token is doing, in one phrase.
 *
 * @param props - The token state to describe.
 * @returns The status element.
 */
function Status({ state }: { state: HostEntry['token'] }) {
  if (state.status === 'checking') return <span className="text-ink-faint">checking…</span>;
  if (state.status === 'ok') {
    return (
      <span className="text-ok">
        <span aria-hidden="true">&#10003;</span> connected as {state.login}
      </span>
    );
  }
  if (state.status === 'bad') return <span className="text-bad">token {state.reason}</span>;
  return <span className="text-ink-faint">no token</span>;
}

/**
 * Props for `HostCard`.
 */
interface HostCardProps {
  /** The host being shown. */
  entry: HostEntry;
  /** Store or clear this host's token. */
  onSaveToken: (host: string, token: string) => Promise<void>;
  /** Give back this host's permission. */
  onRemove: (entry: HostEntry) => Promise<void>;
}

/**
 * Render one host's card.
 *
 * @param props - The host, and the two things that can be done to it.
 * @returns The card.
 */
export function HostCard({ entry, onSaveToken, onRemove }: HostCardProps) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const connected = entry.token.status === 'ok';

  return (
    <li className="rounded-lg border border-edge bg-surface-soft p-3">
      <div className="flex items-baseline gap-2">
        <span className="truncate font-mono text-[12px] font-medium">{entry.host}</span>
        {entry.builtIn && <span className="text-[10px] text-ink-faint">built in</span>}
        {!entry.builtIn && (
          <button
            type="button"
            onClick={() => void onRemove(entry)}
            className="ml-auto text-[11px] text-ink-faint transition hover:text-bad"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mt-1 text-[11px]">
        <Status state={entry.token} />
      </div>

      {(!connected || editing) && (
        <form
          className="mt-2.5 flex gap-1.5"
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
            className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-2 py-1.5 font-mono text-[11px] outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
          >
            Save
          </button>
        </form>
      )}

      {connected && !editing && (
        <div className="mt-2 flex gap-3 text-[11px]">
          <button type="button" className="text-ink-soft transition hover:text-ink" onClick={() => setEditing(true)}>
            Replace token
          </button>
          <button
            type="button"
            className="text-ink-soft transition hover:text-bad"
            onClick={() => void onSaveToken(entry.host, '')}
          >
            Forget
          </button>
        </div>
      )}

      {!connected && (
        <a
          href={tokenPageFor(entry.host)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[11px] text-brand hover:underline"
        >
          Create one on {entry.host} &rarr;
        </a>
      )}
    </li>
  );
}
