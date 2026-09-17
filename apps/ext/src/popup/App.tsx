/**
 * The toolbar popup.
 *
 * Two tabs, because the popup does two unrelated things: Hosts is the settings
 * surface (where Sofa runs, and whether it can read there), and Help answers
 * the questions a token request raises. Keeping the explanation behind a tab is
 * what lets the Hosts tab stay a list rather than a wall of prose.
 */
import { useState } from 'react';
import { Help } from './Help.tsx';
import { HostRow } from './HostRow.tsx';
import { useHosts } from './useHosts.ts';

/**
 * The two tabs, in display order.
 */
const TABS = ['Hosts', 'Help'] as const;

/**
 * Which tab is showing.
 */
type Tab = (typeof TABS)[number];

/**
 * Render the popup.
 *
 * @returns The popup's contents.
 */
export function App() {
  const { entries, loading, addHost, removeHost, setToken } = useHosts();
  const [tab, setTab] = useState<Tab>('Hosts');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <header className="flex items-center gap-2 px-3.5 pt-3">
        <img src="icons/icon-32.png" alt="" width={16} height={16} className="rounded-sm" />
        <h1 className="text-[13px] font-semibold">Sofa</h1>
      </header>

      <nav className="mt-2.5 flex gap-4 border-b border-edge px-3.5">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            aria-current={tab === name}
            className={`-mb-px border-b py-1.5 text-[12px] transition ${
              tab === name
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-faint hover:text-ink-soft'
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      {tab === 'Help' ? (
        <Help />
      ) : (
        <>
          {loading ? (
            <p className="px-3.5 py-6 text-center text-[11px] text-ink-faint">loading</p>
          ) : (
            <ul>
              {entries.map((entry) => (
                <HostRow key={entry.host} entry={entry} onSaveToken={setToken} onRemove={removeHost} />
              ))}
            </ul>
          )}

          <form
            className="border-t border-edge px-3.5 py-2.5"
            onSubmit={async (event) => {
              event.preventDefault();
              setAdding(true);
              setError(await addHost(draft));
              setAdding(false);
              setDraft('');
            }}
          >
            <div className="flex gap-1.5">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="github.mycompany.com"
                aria-label="Add a host"
                className="min-w-0 flex-1 rounded border border-edge bg-surface px-2 py-1 font-mono text-[11px] outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={adding}
                className="rounded border border-edge px-2.5 py-1 text-[11px] transition hover:border-ink-faint disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {error && <p className="mt-1.5 text-[11px] text-bad">{error}</p>}
          </form>
        </>
      )}
    </div>
  );
}
