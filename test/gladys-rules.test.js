// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every team device the Discover tab
// offers, for realistic configurations: every feature-name language, every
// competition, before any data.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMPETITION_KEYS } from '../src/competitions.js';
import { createWorld, fakeEspn } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const scenarios = [
  { label: 'default competitions, French names', config: {} },
  {
    label: 'every competition, English names',
    config: { language: 'en', competitions: COMPETITION_KEYS },
  },
  { label: 'Six Nations, German names', config: { language: 'de', competitions: ['six_nations'] } },
  {
    label: 'Champions Cup, Spanish names',
    config: { language: 'es', competitions: ['champions_cup'] },
  },
  {
    label: 'ESPN down before any reading: nothing offered, nothing guessed',
    config: {},
    api: () => fakeEspn({ fail: true }),
    expectDevices: false,
  },
];
for (const scenario of scenarios) {
  test(`the published device follows the Gladys rules (${scenario.label})`, async () => {
    const { gladys, app } = await createWorld({
      config: scenario.config,
      api: scenario.api?.(),
    });
    try {
      const devices = gladys.fake.discoveredDevices;
      if (scenario.expectDevices === false) {
        assert.equal(devices.length, 0);
      } else {
        assert.ok(devices.length >= 6, `${devices.length} teams offered`);
      }

      for (const device of devices) {
        const where = device.name;

        // should_poll: true if and only if poll_frequency is provided, in ms.
        if (device.poll_frequency === undefined) {
          assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
        } else {
          assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
          assert.ok(
            table.poll_frequencies_ms.includes(device.poll_frequency),
            `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
          );
        }

        assert.ok(device.features.length > 0, `${where}: no feature`);
        const externalIds = new Set();
        const names = new Set();
        for (const feature of device.features) {
          const at = `${where} / ${feature.name}`;
          const pair = table.pairs[`${feature.category}/${feature.type}`];
          assert.ok(
            pair,
            `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`,
          );
          assert.ok(
            pair.label_en && pair.label_fr && pair.icon,
            `${at}: couple without label or icon`,
          );

          assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
          assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
          assert.ok(
            Number.isFinite(feature.min) && Number.isFinite(feature.max),
            `${at}: finite min/max`,
          );
          assert.ok(feature.min <= feature.max, `${at}: min > max`);
          assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
          assert.equal(
            typeof feature.has_feedback,
            'boolean',
            `${at}: has_feedback must be a boolean`,
          );
          if (feature.unit !== undefined) {
            assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
          }

          assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
          externalIds.add(feature.external_id);
          assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
          names.add(feature.name);
        }

        // Gladys shows the generic label of the type when a feature is alone
        // of its type on the device (front/src/utils/device.js): every
        // feature must share its type with another one.
        for (const feature of device.features) {
          const sameType = device.features.filter((other) => other.type === feature.type);
          assert.ok(sameType.length > 1, `${where} / ${feature.name}: alone of its type`);
        }
      }
    } finally {
      await app.stop();
    }
  });
}
