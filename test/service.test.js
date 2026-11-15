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
  // ESPN's /teams still lists last season's Top 14: the calendar of this one
  // brings Vannes (promoted) in and takes Oyonnax (relegated) out.
  assert.ok(devices.some((device) => device.external_id === 'ext:rugby:team:289337'));
  assert.ok(!devices.some((device) => device.external_id === 'ext:rugby:team:190153'));
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

test('a standings route answering 500 keeps the rank held', async (t) => {
  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T17:00:00Z' });
  t.after(() => world.app.stop());
  assert.equal(world.state('rank'), 1);
  api.errors.push({ path: /standings/, status: 500 });
  await world.runUntil('2026-11-28T23:30:00Z');
  assert.equal(world.service.data.standings.top14.rows.length, 14);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
});

test('one competition answering 500 does not hold the others back', async (t) => {
  const api = fakeEspn();
  api.errors.push({ path: /271937\/scoreboard/, status: 500 });
  const world = await createWorld({ api });
  t.after(() => world.app.stop());
  assert.ok(world.api.calls.some((path) => path.includes('180659/scoreboard')));
  assert.equal(world.state('rank'), 1);
  // A document refused is not an outage: tried again 10 minutes later alone.
  assert.equal(world.service.apiError, null);
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  const calls = world.api.calls.length;
  await world.runUntil('2026-11-14T10:11:00Z');
  const again = world.api.calls.slice(calls);
  assert.ok(again.some((path) => path.includes('271937/scoreboard')));
  assert.ok(!again.some((path) => path.includes('270559')));
  // Refused for good: the others keep their pace, the status stays connected.
  await world.runUntil('2026-11-14T11:30:00Z');
  assert.equal(world.gladys.fake.connectionStatus.connected, true);
  assert.equal(world.service.apiError, null);
});

test('a stale "to come" after the kick-off fires nothing twice; a refused event is sent again', async (t) => {
  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T19:00:00Z' });
  t.after(() => world.app.stop());
  const kickoffs = () => world.gladys.fake.sceneEvents.filter((e) => e.key === 'kickoff').length;
  await world.runUntil('2026-11-28T20:00:00Z');
  // Gladys is restarting when ESPN says the match started.
  const refuse = t.mock.method(world.gladys, 'publishSceneEvent', async () => {
    throw new Error('Gladys is restarting');
  });
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 0, away: 0 }));
  await world.runUntil('2026-11-28T20:03:00Z');
  refuse.mock.restore();
  await world.runUntil('2026-11-28T20:05:00Z');
  assert.equal(kickoffs(), 1, 'sent once Gladys is back');
  // A cached document says "to come" again, then "being played".
  api.patch(LYON_TOULOUSE, () => {});
  await world.runUntil('2026-11-28T20:07:00Z');
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 3, away: 0 }));
  await world.runUntil('2026-11-28T20:10:00Z');
  assert.equal(kickoffs(), 1);
  assert.equal(world.state('match_live'), 1);
});

test('a match left "being played" in the cache is not live forever', async (t) => {
  const api = fakeEspn();
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 3, away: 0 }));
  const world = await createWorld({ api, at: '2026-11-28T20:30:00Z' });
  t.after(() => world.app.stop());
  assert.equal(world.state('match_live'), 1);
  api.fail = true;
  await world.runUntil('2026-11-29T00:30:00Z');
  assert.equal(world.state('match_live'), 0);
});

test('the last result survives the months read; an unticked competition is dropped', async (t) => {
  const store = createMemoryStore();
  const first = await createWorld({ store });
  await first.app.stop();
  // Two months later, the November match is out of the months read.
  const world = await createWorld({ store, at: '2027-01-20T10:00:00Z' });
  t.after(() => world.app.stop());
  assert.ok(world.api.calls.some((path) => path.endsWith('dates=202612')));
  assert.ok(!world.api.calls.some((path) => path.endsWith('dates=202611')));
  assert.ok(world.state('last_result'));
  assert.ok(world.service.data.calendar.top14.matches.some((match) => match.id === '604423'));

  await world.gladys.fake.configUpdated({ competitions: ['six_nations'] });
  assert.equal(world.service.data.calendar.top14, undefined);
  assert.equal(world.state('next_match'), 'Aucun match prévu');
});

test('a match called off then played: its kick-off is announced', async (t) => {
  const api = fakeEspn();
  const world = await createWorld({ api, at: '2026-11-28T19:30:00Z' });
  t.after(() => world.app.stop());
  const postpone = (game) => {
    game.status.type.state = 'post';
    game.status.type.completed = false;
    game.status.type.name = 'STATUS_POSTPONED';
  };
  api.patch(LYON_TOULOUSE, postpone);
  await world.runUntil('2026-11-28T19:58:00Z');
  // Played after all: the next full reading ("Check" here) says so.
  api.patch(LYON_TOULOUSE, (game) => play(game, { state: 'in', home: 0, away: 3 }));
  await world.service.check();
  assert.equal(world.gladys.fake.sceneEvents.filter((e) => e.key === 'kickoff').length, 1);
});

test('the teams of a competition: the season played replaces a stale list, a partial one adds', async (t) => {
  const world = await createWorld({ follow: [] });
  t.after(() => world.app.stop());
  const { service } = world;
  const team = (id) => ({ id, name: `Team ${id}`, abbreviation: id });
  const match = (season, home, away) => ({ season, home: team(home), away: team(away) });
  service.data.teams.top14 = { fetched_at: 0, teams: ['1', '2', '3', '4'].map(team) };
  const ids = () =>
    service
      .competitionTeams('top14')
      .map((entry) => entry.id)
      .sort();
  // No calendar (the Six Nations in November): the list.
  service.data.calendar.top14 = { fetched_at: 0, matches: [] };
  assert.deepEqual(ids(), ['1', '2', '3', '4']);
  // The whole season (4 teams, last season's leftovers ignored): it replaces the list.
  service.data.calendar.top14.matches = [
    match(2026, '1', '9'),
    match(2027, '1', '2'),
    match(2027, '3', '5'),
  ];
  assert.deepEqual(ids(), ['1', '2', '3', '5']);
  // Only part of the season (knockout stage, a bye): the list stays, plus the newcomer.
  service.data.calendar.top14.matches = [match(2027, '1', '5')];
  assert.deepEqual(ids(), ['1', '2', '3', '4', '5']);
});

test('a team followed before the fix is still offered and updated', async (t) => {
  // Oyonnax (190153) left the Top 14: added in Gladys, it stays offered.
  const world = await createWorld({ follow: [TOULOUSE, '190153'] });
  t.after(() => world.app.stop());
  const devices = world.gladys.fake.discoveredDevices;
  assert.ok(devices.some((device) => device.external_id === 'ext:rugby:team:190153'));
  assert.ok(world.state('next_match'), 'Stade Toulousain still gets its next match');
});
