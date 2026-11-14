// -----------------------------------------------------------------------------
// The "Rugby team" widget: content within the core vocabulary and budget
// (validateWidgetContent of the SDK), localized by the language of the viewer,
// titled with the name given in Gladys.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LYON_TOULOUSE, SCOTLAND, TOULOUSE, createWorld, fakeEspn, play } from './helpers/world.js';

async function content(world, request) {
  const ack = await world.gladys.fake.widgetGet('rugby_team', request);
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
}

const byType = (widget, type) => widget.components.filter((component) => component.type === type);

function withinBudget(widget, label) {
  assert.deepEqual(validateWidgetContent(widget), [], label);
  assert.ok(widget.components.length <= 8, label);
  assert.ok(byType(widget, 'text').length <= 2, label);
}

test('countdown, rank, next matches and last result, in four languages', async (t) => {
  const world = await createWorld({ follow: [TOULOUSE, SCOTLAND] });
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    withinBudget(await content(world, { settings: {}, language }), language);
  }
  const fr = await content(world, { settings: {}, language: 'fr' });
  assert.equal(byType(fr, 'text')[0].text, 'Rugby · team 25922', 'the name given in Gladys');
  assert.deepEqual(
    byType(fr, 'value').map((tile) => [tile.label, tile.value]),
    [
      ['Prochain match', '14 j 10 h'],
      ['Classement', '1er'],
    ],
  );
  assert.deepEqual(
    byType(fr, 'card-list')[0].items.map((item) => [item.title, item.subtitle]),
    [
      ['Lyon – Stade Toulousain (Top 14)', 'sam. 28 nov. · 21:00'],
      ['Stade Toulousain – Racing 92 (Top 14)', 'sam. 5 déc. · 14:30'],
      ['Lions – Stade Toulousain (Champions Cup)', 'sam. 12 déc. · 14:00'],
    ],
  );
  assert.deepEqual(byType(fr, 'status')[0].items, [
    { label: 'Dernier match', value: 'Victoire 28-18 · Clermont Auvergne', color: 'success' },
  ]);

  // Optional blocks can be hidden; another followed team can be chosen.
  const bare = await content(world, {
    settings: { show_upcoming: false, show_last: false },
    language: 'en',
  });
  assert.deepEqual(byType(bare, 'card-list'), []);
  assert.deepEqual(byType(bare, 'status'), []);
  const scotland = await content(world, {
    settings: { device: 'ext:rugby:team:2' },
    language: 'en',
  });
  withinBudget(scotland, 'scotland');
  assert.deepEqual(
    byType(scotland, 'value').map((tile) => tile.value),
    ['None yet'],
  );
});

test('during a match: the live score first', async (t) => {
  const api = fakeEspn();
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 6, away: 13 }));
  const world = await createWorld({ api, at: '2026-11-28T20:30:00Z' });
  t.after(() => world.app.stop());
  const widget = await content(world, { settings: {}, language: 'fr' });
  withinBudget(widget, 'live');
  assert.deepEqual(byType(widget, 'value')[0], {
    type: 'value',
    label: 'En direct · Lyon',
    value: '13 – 6',
    icon: 'activity',
    color: 'success',
  });
  assert.equal(widget.ttl_seconds, 120);
});

test('no team followed: says how to add one', async (t) => {
  const world = await createWorld({ follow: [] });
  t.after(() => world.app.stop());
  const widget = await content(world, { settings: {}, language: 'de' });
  withinBudget(widget, 'none');
  assert.match(byType(widget, 'text')[0].text, /Entdecken/);
});
