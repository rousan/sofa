/**
 * Offline harness entry point.
 *
 * Opens the real panel against the fixture source, so the layout, the tree, the
 * merge and the highlighter can all be checked in a plain browser tab without a
 * pull request or a forge session.
 */
import { openPanel } from '../src/ui/panel.ts';
import { fixtureSource } from './fixture.ts';

openPanel(
  { origin: 'https://example.test', owner: 'dev', repo: 'scaligent', number: 68913, tab: 'files' },
  { source: fixtureSource },
);
