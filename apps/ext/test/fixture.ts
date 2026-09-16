/**
 * Fixture data for `test/harness.html`.
 *
 * The point of the harness is to render the panel with no network and no pull
 * request, so the fixture provides both halves of the real data flow: a unified
 * diff, and the head-revision text of the files it touches. The diff's line
 * numbers are computed from the head text rather than written by hand, so the
 * merge in `src/model.ts` is exercised on genuinely consistent input.
 */
import type { DiffSource } from '../src/ui/panel.ts';
import { parseUnifiedDiff } from '@sofa/core';

/**
 * A long-ish source file whose only change sits deep inside a function, which
 * is exactly the case GitHub renders without the surrounding function.
 */
const chartSettingsHead: string[] = [
  '/**',
  ' * Build the custom visual props payload for a chart.',
  ' */',
  "import { stripTypename } from './helpers';",
  '',
  'export function buildCustomVisualProps(options) {',
  '  const { isChartSettingsV2Enabled, existingCustomVisualProps } = options;',
  '  let result = { ...existingCustomVisualProps };',
  '',
];
for (let step = 1; step <= 25; step++) {
  chartSettingsHead.push(`  // step ${step}: normalise one slice of the incoming props`);
  chartSettingsHead.push(`  result = mergeSlice(result, options.slice${step}, ${step});`);
}
chartSettingsHead.push(
  '',
  '  if (!isChartSettingsV2Enabled) {',
  '    return result;',
  '  }',
  '',
  '  // NEW: drop every __typename the GraphQL layer injected, at any depth.',
  '  result = stripTypename(result);',
  '  result.version = "6.2.0";',
  '',
  '  return result;',
  '}',
);

/**
 * A package manifest with one added dependency line, padded so the change sits
 * far enough down the file to prove the whole file is rendered.
 */
const packageJsonHead: string[] = [
  '{',
  '  "name": "@acme/charts",',
  '  "version": "1.0.0",',
];
for (let filler = 1; filler <= 44; filler++) {
  packageJsonHead.push(`  "filler${filler}": ${filler},`);
}
packageJsonHead.push(
  '  "dependencies": {',
  '    "@sentry/core": "8.48.0",',
  '    "@acme/render": "0.2.19",',
  '    "@acme/settings-versions": "6.2.0",',
  '    "@acme/chart-sdk": "2.14.3",',
  '    "dompurify": "^3.3.2"',
  '  }',
  '}',
);

/**
 * Build one file's diff, deriving the `@@` header from the head text.
 *
 * @param path - Path of the changed file.
 * @param headLines - The file's head-revision lines.
 * @param firstContext - Text of the first context line of the hunk, located in
 *   `headLines` to fix the hunk's starting line number.
 * @param body - The hunk body, each line carrying its diff marker.
 * @returns The file's section of a unified diff.
 */
function fileDiff(path: string, headLines: string[], firstContext: string, body: string[]): string[] {
  const newStart = headLines.indexOf(firstContext) + 1;
  const oldCount = body.filter((line) => !line.startsWith('+')).length;
  const newCount = body.filter((line) => !line.startsWith('-')).length;
  return [
    `diff --git a/${path} b/${path}`,
    'index 1111111..2222222 100644',
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${newStart},${oldCount} +${newStart},${newCount} @@ export function buildCustomVisualProps(options) {`,
    ...body,
  ];
}

/**
 * The fixture pull request: a modified file, a manifest bump, an added file, a
 * deleted file and a binary, which between them cover every rendering path.
 */
const diffLines: string[] = [
  ...fileDiff(
    'packages/chart-app/src/utils/chart-settings/custom-visual-props.ts',
    chartSettingsHead,
    '  }',
    [
      '   }',
      ' ',
      '-  result.version = "6.1.0";',
      '+  // NEW: drop every __typename the GraphQL layer injected, at any depth.',
      '+  result = stripTypename(result);',
      '+  result.version = "6.2.0";',
      ' ',
      '   return result;',
    ],
  ),
  ...fileDiff(
    'packages/charts/package.json',
    packageJsonHead,
    '    "@sentry/core": "8.48.0",',
    [
      '     "@sentry/core": "8.48.0",',
      '     "@acme/render": "0.2.19",',
      '+    "@acme/settings-versions": "6.2.0",',
      '     "@acme/chart-sdk": "2.14.3",',
    ],
  ),
  'diff --git a/packages/charts/playwright/helpers/settings-structure.ts b/packages/charts/playwright/helpers/settings-structure.ts',
  'new file mode 100644',
  '--- /dev/null',
  '+++ b/packages/charts/playwright/helpers/settings-structure.ts',
  '@@ -0,0 +1,6 @@',
  '+/**',
  '+ * Assert the rendered chart settings tree matches the expected structure.',
  '+ */',
  '+export function assertStructure(actual, expected) {',
  '+  expect(normalise(actual)).toEqual(normalise(expected));',
  '+}',
  'diff --git a/packages/legacy/old-helper.ts b/packages/legacy/old-helper.ts',
  'deleted file mode 100644',
  '--- a/packages/legacy/old-helper.ts',
  '+++ /dev/null',
  '@@ -1,3 +0,0 @@',
  '-export function oldHelper() {',
  '-  return 1;',
  '-}',
  'diff --git a/docs/screenshot.png b/docs/screenshot.png',
  'new file mode 100644',
  'Binary files /dev/null and b/docs/screenshot.png differ',
];

/**
 * Head text keyed by path, standing in for the `/raw/<sha>/<path>` endpoint.
 */
const headFiles: Record<string, string> = {
  'packages/chart-app/src/utils/chart-settings/custom-visual-props.ts': `${chartSettingsHead.join('\n')}\n`,
  'packages/charts/package.json': `${packageJsonHead.join('\n')}\n`,
};

/**
 * The fixture's diff as one document, as the forge's `.diff` endpoint returns it.
 */
export const diffText = `${diffLines.join('\n')}\n`;

/**
 * The fixture's head-revision file texts, keyed by repository path.
 */
export const headFileTexts = headFiles;

/**
 * A `DiffSource` backed entirely by the fixture above.
 */
export const fixtureSource: DiffSource = {
  fetchPullRequest: async () => ({
    files: parseUnifiedDiff(diffLines.join('\n')),
    headSha: 'f'.repeat(40),
    error: null,
  }),
  fetchFileAtSha: async (_ctx, _sha, path) => headFiles[path] ?? null,
  fetchReviewThreads: async () => ({ threads: [], error: null }),
};
