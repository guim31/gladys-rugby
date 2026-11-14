// -----------------------------------------------------------------------------
// The configuration as Gladys sends it: fields never saved are absent, and a
// wrong entry falls back to the default, never thrown.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('an empty configuration gives the defaults', () => {
  assert.deepEqual(normalizeConfig({}), DEFAULT_CONFIG);
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG);
});

test('competitions: known keys only, in the order of the list; empty stays empty', () => {
  assert.deepEqual(normalizeConfig({ competitions: ['six_nations', 'pro_d2', 'top14'] }), {
    language: 'fr',
    competitions: ['top14', 'six_nations'],
  });
  assert.deepEqual(normalizeConfig({ competitions: 'urc, top14' }).competitions, ['top14', 'urc']);
  assert.deepEqual(normalizeConfig({ competitions: [] }).competitions, []);
  assert.equal(normalizeConfig({ language: 'it' }).language, 'fr');
});
