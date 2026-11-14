// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHECK_ACTION } from '../src/app.js';
import { COMPETITION_KEYS } from '../src/competitions.js';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { LEAD_MINUTES, RESULTS, TRIGGERS, WIDGET_KEY } from '../src/service.js';
import { WIDGETS } from '../src/widgets.js';
import { LYON_TOULOUSE, createWorld, fakeEspn, play } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const registered = await createWorld({ connect: false });
const handlerKeys = (prefix) =>
  Object.keys(registered.gladys.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const values = (field) => field.options.map((option) => option.value);
const trigger = (key) => manifest.scene_triggers.find((entry) => entry.key === key);

test('identity: name, image, cover, transports, category', () => {
  assert.equal(manifest.name, 'Rugby');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-rugby:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-rugby/main/cover.png',
  );
  // Everything comes from a public API on the Internet.
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['leisure']);
});

test('scene triggers, scene actions and widgets require Gladys >= 5.1.0', () => {
  assert.equal(manifest.gladys_version, '>=5.1.0');
});

test('every manifest action has a registered handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions), [CHECK_ACTION]);
  assert.deepEqual(handlerKeys('action:'), [CHECK_ACTION]);
});

test('"Check" reports the competitions and the teams in every language', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.gladys.fake.action(CHECK_ACTION, {});
  assert.equal(ack.success, true, ack.error);
  assert.deepEqual(Object.keys(ack.data.message).sort(), [...LANGUAGES].sort());
  const fr = ack.data.message.fr;
  assert.match(fr, /^Top 14 : 95 matchs lus, 14 équipes\./);
  assert.match(fr, /Stade Toulousain, prochain match : chez Lyon \(Top 14\), samedi 28 novembre/);
  assert.match(fr, /Stade Toulousain a battu Clermont Auvergne 28 à 18 \(Top 14\)\./);
  assert.match(fr, /1er en Top 14\./);
  assert.match(fr, /Données lues à l'instant/);

  const down = await createWorld({ api: fakeEspn({ fail: true }), follow: [] });
  t.after(() => down.app.stop());
  const failed = await down.gladys.fake.action(CHECK_ACTION, {});
  assert.match(failed.data.message.en, /ESPN could not be read/);
  assert.match(failed.data.message.en, /No team followed yet/);
});

test('every scene action has a handler, and returns the declared outputs', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_actions), Object.keys(SCENE_ACTIONS));
  assert.deepEqual(handlerKeys('sceneAction:'), Object.keys(SCENE_ACTIONS));
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const action of manifest.scene_actions) {
    const ack = await world.gladys.fake.sceneAction(action.key, {
      device: 'ext:rugby:team:25922',
    });
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(Object.keys(ack.data.outputs).sort(), keysOf(action.outputs).sort());
    for (const output of action.outputs) {
      assert.equal(typeof ack.data.outputs[output.key], output.type, output.key);
    }
  }
  const none = await createWorld({ follow: [] });
  t.after(() => none.app.stop());
  const refused = await none.gladys.fake.sceneAction('read_team', {});
  assert.equal(refused.success, false);
  assert.match(refused.error, /No team followed/);
});

test('the scene triggers fired are the declared ones, with their filters and variables', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(TRIGGERS).sort());
  const starting = trigger(TRIGGERS.MATCH_STARTING);
  assert.deepEqual(values(starting.fields[1]), LEAD_MINUTES.map(String));
  assert.equal(starting.fields[1].required, true, 'an empty lead would match every lead time');
  assert.deepEqual(values(trigger(TRIGGERS.MATCH_FINISHED).fields[1]), RESULTS);

  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T17:30:00Z' });
  t.after(() => world.app.stop());
  await world.runUntil('2026-11-28T20:01:00Z');
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 3, away: 0 }));
  await world.runUntil('2026-11-28T20:30:00Z');
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'post', home: 20, away: 20 }));
  await world.runUntil('2026-11-28T21:50:00Z');
  const fired = new Map(world.gladys.fake.sceneEvents.map((event) => [event.key, event.data]));
  assert.deepEqual([...fired.keys()].sort(), Object.values(TRIGGERS).sort());
  assert.equal(fired.get(TRIGGERS.MATCH_FINISHED).result, 'draw');
  for (const declared of manifest.scene_triggers) {
    const data = fired.get(declared.key);
    // Filters match keys of `data`, variables read keys of `data`.
    for (const key of [...keysOf(declared.fields), ...keysOf(declared.variables)]) {
      assert.ok(key in data, `${declared.key}: "${key}" is in the event data`);
    }
    for (const variable of declared.variables) {
      assert.equal(typeof data[variable.key], variable.type, `${declared.key}.${variable.key}`);
    }
    assert.ok(Object.keys(data).length <= 30);
  }
});

test('every widget has a handler', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
});

test('config_schema defaults and options stay consistent with the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[entry.key], entry.default, `DEFAULT_CONFIG.${entry.key}`);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  const field = (key) => manifest.config_schema.find((entry) => entry.key === key);
  assert.deepEqual(values(field('language')), LANGUAGES);
  assert.deepEqual(values(field('competitions')), COMPETITION_KEYS);
});

test('section fields are purely presentational', () => {
  const sections = manifest.config_schema.filter((entry) => entry.type === 'section');
  assert.ok(sections.length > 0);
  for (const section of sections) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
  }
});

test('no secret field anywhere: nothing here is secret', () => {
  assert.ok(allFields.every((entry) => entry.type !== 'secret'));
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
