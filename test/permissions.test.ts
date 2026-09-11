/**
 * Tests for the host-pattern handling shared by the popup and the service
 * worker, which is the only pure logic in the runtime-permissions flow.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hostOf, toMatchPattern } from '../src/permissions.ts';

test('accepts the shapes a user might paste', () => {
  assert.equal(toMatchPattern('github.mycorp.com'), '*://github.mycorp.com/*');
  assert.equal(toMatchPattern('  github.mycorp.com  '), '*://github.mycorp.com/*');
  assert.equal(toMatchPattern('https://github.mycorp.com'), '*://github.mycorp.com/*');
  assert.equal(toMatchPattern('https://github.mycorp.com/org/repo/pull/1'), '*://github.mycorp.com/*');
  assert.equal(toMatchPattern('github.mycorp.com:8443'), '*://github.mycorp.com/*');
  assert.equal(toMatchPattern('*://github.mycorp.com/*'), '*://github.mycorp.com/*');
});

test('rejects text that does not name a host', () => {
  assert.equal(toMatchPattern(''), null);
  assert.equal(toMatchPattern('   '), null);
  assert.equal(toMatchPattern('localhost'), null);
  assert.equal(toMatchPattern('not a host'), null);
  assert.equal(toMatchPattern('*://*/*'), null);
});

test('reads the hostname back out of a pattern', () => {
  assert.equal(hostOf('*://github.mycorp.com/*'), 'github.mycorp.com');
});
