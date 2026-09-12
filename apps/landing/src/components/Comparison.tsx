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
 * What GitHub shows: the two lines that changed, and little else.
 */
const BEFORE: MockLine[] = [
  { no: 0, text: '@@ -15,5 +15,5 @@', kind: 'skip' },
  { no: 15, text: '  const mid = Math.floor(arr.length / 2);' },
  { no: 16, text: '  const left = mergeSort(arr.slice(0, mid));', kind: 'del' },
  { no: 17, text: '  const right = mergeSort(arr.slice(mid));', kind: 'del' },
  { no: 16, text: '  const left = mergeSort(arr.slice(0, mid), cmp);', kind: 'add' },
  { no: 17, text: '  const right = mergeSort(arr.slice(mid), cmp);', kind: 'add' },
  { no: 18, text: '' },
  { no: 19, text: '  return merge(left, right, cmp);' },
];

/**
 * What Sofa shows: the same change, inside the function that explains it.
 *
 * The signature is the point. Two lines forgot to pass `compare` down the
 * recursion, and you cannot see that from the hunk alone, because the default
 * comparator that makes it wrong is four lines above the change.
 */
const AFTER: MockLine[] = [
  { no: 11, text: 'function mergeSort(arr, cmp = (a, b) => a - b) {' },
  { no: 12, text: '  if (arr.length <= 1) {' },
  { no: 13, text: '    return arr;' },
  { no: 14, text: '  }' },
  { no: 15, text: '' },
  { no: 15, text: '  const mid = Math.floor(arr.length / 2);' },
  { no: 16, text: '  const left = mergeSort(arr.slice(0, mid));', kind: 'del' },
  { no: 17, text: '  const right = mergeSort(arr.slice(mid));', kind: 'del' },
  { no: 16, text: '  const left = mergeSort(arr.slice(0, mid), cmp);', kind: 'add' },
  { no: 17, text: '  const right = mergeSort(arr.slice(mid), cmp);', kind: 'add' },
  { no: 18, text: '' },
  { no: 19, text: '  return merge(left, right, cmp);' },
  { no: 20, text: '}' },
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
        'overflow-hidden rounded-2xl border bg-card',
        highlight ? 'border-ink/25' : 'border-edge',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-edge px-4 py-2.5">
        <span className="font-semibold">{title}</span>
        <span className="text-[12px] text-ink-faint">{note}</span>
      </div>
      <div className="overflow-x-auto py-1 font-mono text-[11px] leading-5">
        {lines.map((line, index) => (
          <div
            key={`${line.no}-${index}`}
            className={[
              'flex whitespace-pre px-3',
              line.kind === 'add' ? 'bg-plus/10' : '',
              line.kind === 'del' ? 'bg-minus/10' : '',
              line.kind === 'skip' ? 'bg-canvas text-ink-faint' : '',
            ].join(' ')}
          >
            <span className="w-9 shrink-0 select-none text-right text-ink-faint">
              {line.kind === 'skip' ? '' : line.no}
            </span>
            <span className="w-4 shrink-0 select-none text-center text-ink-faint">
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
      <Mock title="GitHub" note="the lines that changed" lines={BEFORE} />
      <Mock title="Sofa" note="the function they live in" lines={AFTER} highlight />
    </div>
  );
}
