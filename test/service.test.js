// -----------------------------------------------------------------------------
// The service on its own clock, against ESPN answers recorded on 2026-11-14:
// the teams offered in the Discover tab, the states of a followed team, a
// match day (Lyon – Stade Toulousain, 2026-11-28 20:00Z) played minute by
// minute, the requests it costs, and failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LYON_TOULOUSE,
  SCOTLAND,
  TOULOUSE,
  createMemoryStore,
  createWorld,
  fakeEspn,
  play,
} from './helpers/world.js';

const live = (path) => /scoreboard\?dates=\d{8}$/.test(path);

test('the Discover tab offers every team of the chosen competitions, once', async (t) => {
  const world = await createWorld({ follow: [] });
  t.after(() => world.app.stop());
  const devices = world.gladys.fake.discoveredDevices;
  // Top 14 (14) + Champions Cup (24) + Six Nations (6), 8 clubs in both.
  assert.equal(devices.length, 36);
  const toulouse = devices.find((device) => device.external_id === 'ext:rugby:team:25922');
  assert.equal(toulouse.name, 'Rugby · Stade Toulousain');
  assert.equal(toulouse.should_poll, false);
  assert.ok(devices.some((device) => device.name === 'Rugby · Écosse'));
  // Nothing followed: no state, no standings read.
  assert.equal(world.gladys.fake.states.length, 0);
  assert.ok(!world.api.calls.some((path) => path.includes('standings')));

  // Fewer competitions: fewer teams, in the language chosen.
  await world.gladys.fake.configUpdated({ competitions: ['six_nations'], language: 'en' });
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((device) => device.name),
    ['England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales'].map((n) => `Rugby · ${n}`),
  );
});

test('a followed team: next match, last result, scores and rank; a team without match', async (t) => {
  const world = await createWorld({ follow: [TOULOUSE, SCOTLAND] });
  t.after(() => world.app.stop());
  const states = Object.fromEntries(
    [
      'next_match',
      'next_kickoff',
      'next_venue',
      'last_result',
      'days_until_match',
      'match_live',
      'match_today',
      'team_score',
      'opponent_score',
      'rank',
    ].map((key) => [key, [world.state(key), world.state(key, SCOTLAND)]]),
  );
  assert.deepEqual(states, {
    next_match: ['Lyon – Stade Toulousain (Top 14)', 'Aucun match prévu'],
    next_kickoff: ['sam. 28 nov. · 21:00', 'Aucun match prévu'],
    next_venue: ['Matmut Stadium de Gerland, Lyon', 'Aucun match prévu'],
    last_result: ['Victoire 28-18 contre Clermont Auvergne (Top 14)', undefined],
    days_until_match: [14, -1],
    match_live: [0, 0],
    match_today: [0, 0],
    team_score: [28, undefined],
    opponent_score: [18, undefined],
    rank: [1, undefined],
  });
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('a quiet day costs no request; the calendar is read again after 6 hours', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const first = world.api.calls.length;
  assert.equal(first, 4 * 6 + 1, '4 competitions: teams + 5 months, and the Top 14 standings');
  await world.runUntil('2026-11-14T15:59:00Z');
  assert.equal(world.api.calls.length, first);
  await world.runUntil('2026-11-14T16:01:00Z');
  assert.equal(world.api.calls.length - first, 4 * 5 + 1);
  assert.ok(!world.api.calls.some(live));
});

test('match day: starting soon, kick-off, live score, final whistle, standings again', async (t) => {
  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T17:50:00Z' });
  t.after(() => world.app.stop());
  const events = () => world.gladys.fake.sceneEvents;

  await world.runUntil('2026-11-28T19:55:00Z');
  assert.deepEqual(
    events().map((event) => [event.key, event.data.minutes_before]),
    [
      ['match_starting', '120'],
      ['match_starting', '60'],
      ['match_starting', '30'],
      ['match_starting', '15'],
    ],
  );
  const soon = events()[2].data;
  assert.equal(soon.device, 'ext:rugby:team:25922');
  assert.equal(soon.team, 'Stade Toulousain');
  assert.equal(soon.opponent, 'Lyon');
  assert.equal(soon.home, false);
  assert.equal(soon.kickoff_time, '21:00');
  assert.equal(
    soon.sentence,
    'Stade Toulousain contre Lyon (Top 14) commence dans 30 minutes, à 21:00.',
  );
  assert.equal(world.state('match_today'), 1);
  assert.equal(world.api.calls.filter(live).length, 1, 'read live from 5 minutes before');

  // ESPN says it started, two minutes late.
  await world.runUntil('2026-11-28T20:01:00Z');
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 0, away: 7 }));
  await world.runUntil('2026-11-28T20:02:00Z');
  const kickoff = events().filter((event) => event.key === 'kickoff');
  assert.equal(kickoff.length, 1);
  assert.equal(kickoff[0].data.sentence, "Coup d'envoi : Stade Toulousain contre Lyon (Top 14).");
  assert.equal(world.state('match_live'), 1);
  assert.equal(world.state('team_score'), 7);
  assert.equal(world.state('opponent_score'), 0);
  assert.equal(world.state('next_match'), 'Stade Toulousain – Racing 92 (Top 14)');

  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 10, away: 14 }));
  await world.runUntil('2026-11-28T20:40:00Z');
  assert.equal(world.state('opponent_score'), 10);
  assert.equal(world.state('team_score'), 14);

  const before = world.api.calls.filter((path) => path.includes('standings')).length;
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'post', home: 17, away: 27 }));
  await world.runUntil('2026-11-28T21:45:00Z');
  const finished = events().filter((event) => event.key === 'match_finished');
  assert.equal(finished.length, 1);
  assert.deepEqual(
    [finished[0].data.result, finished[0].data.team_score, finished[0].data.opponent_score],
    ['win', 27, 17],
  );
  assert.equal(finished[0].data.sentence, 'Stade Toulousain a battu Lyon 27 à 17 (Top 14).');
  assert.equal(world.state('match_live'), 0);
  assert.equal(world.state('last_result'), 'Victoire 27-17 contre Lyon (Top 14)');
  assert.ok(world.api.calls.filter((path) => path.includes('standings')).length > before);

  // Live reading stops with the final whistle: one request a minute meanwhile.
  const liveCalls = world.api.calls.filter(live).length;
  assert.ok(liveCalls >= 40 && liveCalls <= 110, `${liveCalls} live requests`);
  await world.runUntil('2026-11-28T23:00:00Z');
  assert.equal(world.api.calls.filter(live).length, liveCalls);
  assert.equal(events().filter((event) => event.key === 'kickoff').length, 1);
});

test('a restart announces nothing already seen, and nothing old', async (t) => {
  const store = createMemoryStore();
  const api = fakeEspn();
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'post', home: 17, away: 27 }));
  // Installed after the match: its end is not news.
  const world = await createWorld({ api, store, at: '2026-11-28T23:00:00Z' });
  t.after(() => world.app.stop());
  await world.runUntil('2026-11-29T01:00:00Z');
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
  assert.equal(world.state('last_result'), 'Victoire 27-17 contre Lyon (Top 14)');
});

test('ESPN down: the status says it in four languages, retried every 10 minutes', async (t) => {
  const api = fakeEspn({ fail: true });
  const world = await createWorld({ api });
  t.after(() => world.app.stop());
  const status = world.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.deepEqual(Object.keys(status.message).sort(), ['de', 'en', 'es', 'fr']);
  assert.match(status.message.fr, /ESPN ne répond pas/);
  // Nothing read: no state is guessed.
  assert.equal(world.gladys.fake.states.length, 0);
  const calls = world.api.calls.length;
  await world.runUntil('2026-11-14T10:09:00Z');
  assert.equal(world.api.calls.length, calls);
  api.fail = false;
  await world.runUntil('2026-11-14T10:11:00Z');
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.state('rank'), 1);
});

test('the cache in /data serves a restart without ESPN', async (t) => {
  const store = createMemoryStore();
  const first = await createWorld({ store });
  await first.app.stop();
  const world = await createWorld({ store, api: fakeEspn({ fail: true }) });
  t.after(() => world.app.stop());
  assert.equal(world.state('next_match'), 'Lyon – Stade Toulousain (Top 14)');
  assert.equal(world.api.calls.length, 0, 'nothing due: the cache is fresh');
});

test('a team added: its states are published at once, the widget refreshed', async (t) => {
  const world = await createWorld({ follow: [] });
  t.after(() => world.app.stop());
  const device = world.gladys.fake.discoveredDevices.find(
    (entry) => entry.external_id === 'ext:rugby:team:25922',
  );
  await world.gladys.fake.deviceCreated(device);
  assert.equal(world.state('rank'), 1);
  assert.equal(world.state('next_match'), 'Lyon – Stade Toulousain (Top 14)');
  assert.ok(world.gladys.fake.widgetRefreshes.includes('rugby_team'));
});
