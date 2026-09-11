/**
 * The before and after, drawn rather than screenshotted.
 *
 * Two small mock diffs sit side by side: what GitHub gives you, and what Sofa
 * gives you. Building them from markup instead of images keeps them sharp,
 * themeable, and honest about the one thing that matters, which is how much of
 * the file you can see.
 */

/**
 * One line of a mock diff.
 */
interface MockLine {
  /** Line number in the file. */
  no: number;
  /** The code, already trimmed to fit. */
  text: string;
  /** How the line should read. */
  kind?: 'add' | 'del' | 'context' | 'skip';
}

/**
 * What GitHub shows: the change, and almost nothing round it.
 */
const BEFORE: MockLine[] = [
  { no: 0, text: '@@ -142,7 +142,7 @@', kind: 'skip' },
  { no: 142, text: '  const rows = [];' },
  { no: 143, text: '  for (const hunk of hunks) {' },
  { no: 144, text: '    cursor = hunk.start;', kind: 'del' },
  { no: 144, text: '    cursor = Math.max(cursor, hunk.start);', kind: 'add' },
  { no: 145, text: '    delta += hunk.newCount;' },
  { no: 146, text: '  }' },
];

/**
 * What Sofa shows: the same change, inside the function it belongs to.
 */
const AFTER: MockLine[] = [
  { no: 131, text: 'export function mergeFullFile(file, head) {' },
  { no: 132, text: '  let cursor = 1;' },
  { no: 133, text: '  let delta = 0;' },
  { no: 134, text: '' },
  { no: 135, text: '  // walk the file, not just the hunks' },
  { no: 140, text: '  const rows = [];' },
  { no: 143, text: '  for (const hunk of hunks) {' },
  { no: 144, text: '    cursor = hunk.start;', kind: 'del' },
  { no: 144, text: '    cursor = Math.max(cursor, hunk.start);', kind: 'add' },
  { no: 145, text: '    delta += hunk.newCount;' },
  { no: 146, text: '  }' },
  { no: 147, text: '' },
  { no: 148, text: '  return { rows, reliable };' },
  { no: 149, text: '}' },
];

/**
 * Render one mock diff.
 *
 * @param props - The heading, the lines, and whether this is the good one.
 * @returns The panel.
 */
function Mock({ title, note, lines, highlight }: { title: string; note: string; lines: MockLine[]; highlight?: boolean }) {
  return (
    <div
      className={[
        'overflow-hidden rounded-xl border bg-surface',
        highlight ? 'border-brand/40 ring-1 ring-brand/20' : 'border-edge',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-edge bg-surface-soft px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-ink-soft">{note}</span>
      </div>
      <div className="overflow-x-auto py-1 font-mono text-[11px] leading-5">
        {lines.map((line, index) => (
          <div
            key={`${line.no}-${index}`}
            className={[
              'flex whitespace-pre px-3',
              line.kind === 'add' ? 'bg-plus/10' : '',
              line.kind === 'del' ? 'bg-minus/10' : '',
              line.kind === 'skip' ? 'bg-surface-soft text-ink-soft' : '',
            ].join(' ')}
          >
            <span className="w-9 shrink-0 select-none text-right text-ink-soft/70">
              {line.kind === 'skip' ? '' : line.no}
            </span>
            <span className="w-4 shrink-0 select-none text-center text-ink-soft/70">
              {line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ''}
            </span>
            <span className={line.kind === 'add' ? 'text-plus' : line.kind === 'del' ? 'text-minus' : ''}>
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render the before and after pair.
 *
 * @returns The comparison.
 */
export function Comparison() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Mock title="GitHub" note="7 lines of the file" lines={BEFORE} />
      <Mock title="Sofa" note="the function it lives in" lines={AFTER} highlight />
    </div>
  );
}
