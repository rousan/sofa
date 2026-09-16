/**
 * The toolbar popup.
 *
 * It answers two questions: where does Sofa run, and can it read from there.
 * Everything else about the extension happens on the pull request page, so this
 * stays a settings panel and does not try to be a dashboard.
 */
import { useState } from 'react';
import { HostCard } from './HostCard.tsx';
import { useHosts } from './useHosts.ts';

/**
 * Render the popup.
 *
 * @returns The popup's contents.
 */
export function App() {
  const { entries, loading, addHost, removeHost, setToken } = useHosts();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="p-3.5">
      <header className="mb-3 flex items-center gap-2">
        <img src="icons/icon-32.png" alt="" width={20} height={20} className="rounded" />
        <h1 className="text-[14px] font-semibold">Sofa</h1>
        <a
          href="https://sofa.rousanali.com/"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[11px] text-ink-faint transition hover:text-ink"
        >
          Help
        </a>
      </header>

      <p className="mb-3 text-[11px] leading-relaxed text-ink-soft">
        A token lets Sofa read the diff and the review comments through the forge&rsquo;s API, which
        is the reliable route. Fine-grained, with <span className="font-medium text-ink">Pull requests: Read</span>{' '}
        and <span className="font-medium text-ink">Contents: Read</span>.
      </p>

      {loading ? (
        <p className="py-6 text-center text-[11px] text-ink-faint">loading…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <HostCard key={entry.host} entry={entry} onSaveToken={setToken} onRemove={removeHost} />
          ))}
        </ul>
      )}

      <form
        className="mt-3 border-t border-edge pt-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setAdding(true);
          setError(await addHost(draft));
          setAdding(false);
          setDraft('');
        }}
      >
        <label htmlFor="new-host" className="mb-1.5 block text-[11px] font-medium">
          Add a GitHub Enterprise host
        </label>
        <div className="flex gap-1.5">
          <input
            id="new-host"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="github.mycompany.com"
            className="min-w-0 flex-1 rounded-md border border-edge bg-surface px-2 py-1.5 font-mono text-[11px] outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-md border border-edge px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-brand hover:text-brand disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-1.5 text-[11px] text-bad">{error}</p>}
      </form>
    </div>
  );
}
