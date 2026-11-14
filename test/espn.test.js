// -----------------------------------------------------------------------------
// The ESPN client and its parsers, on answers recorded on 2026-11-14: a month
// of Top 14 (finished, scheduled and not yet timed matches), a match being
// played (Ireland – Fiji, Nations Championship), standings with and without
// pools, and the errors ESPN gives.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEspn, parseScoreboard, parseStandings, parseTeams } from '../src/espn.js';
import { calendarMonths } from '../src/service.js';
import { fixture, LYON_TOULOUSE, TOULOUSE } from './helpers/world.js';

test('a month of Top 14: finished and scheduled matches, home and away, venue', () => {
  const matches = parseScoreboard(fixture('top14-202611'), 'top14');
  assert.equal(matches.length, 17);
  const won = matches.find((match) => match.id === '604423');
  assert.deepEqual(
    {
      state: won.state,
      completed: won.completed,
      home: [won.home.id, won.home.name, won.home.score, won.home.winner],
      away: [won.away.name, won.away.score],
      venue: won.venue,
      city: won.city,
      season: won.season,
      start: new Date(won.start).toISOString(),
    },
    {
      state: 'post',
      completed: true,
      home: [TOULOUSE, 'Stade Toulousain', 28, true],
      away: ['Clermont Auvergne', 18],
      venue: 'Stade Ernest-Wallon',
      city: 'Toulouse',
      season: 2027,
      start: '2026-11-07T13:30:00.000Z',
    },
  );
  const next = matches.find((match) => match.id === LYON_TOULOUSE);
  assert.equal(next.state, 'pre');
  assert.equal(next.timed, true);
  assert.equal(next.away.id, TOULOUSE);
});

test('a kick-off not set yet is a day without time', () => {
  const december = parseScoreboard(fixture('top14-202612'), 'top14');
  const boxing = december.filter((match) => match.start === Date.parse('2026-12-26T00:00Z'));
  assert.ok(boxing.length >= 7);
  assert.ok(boxing.every((match) => match.timed === false));
});

test('a match being played: state "in" and the live score', () => {
  const matches = parseScoreboard(fixture('nc-20261114-live'), 'nations_championship');
  const live = matches.find((match) => match.state === 'in');
  assert.deepEqual(
    [live.home.name, live.home.score, live.away.name, live.away.score, live.status],
    ['Ireland', 7, 'Fiji', 12, 'STATUS_FIRST_HALF'],
  );
  assert.equal(matches.filter((match) => match.state === 'post' && match.completed).length, 3);
});

test('an empty month and broken entries are no matches, never an error', () => {
  assert.deepEqual(parseScoreboard(fixture('sixnations-202611'), 'six_nations'), []);
  assert.deepEqual(parseScoreboard({ events: [{ id: '1' }, null, { competitions: [] }] }), []);
  assert.deepEqual(parseScoreboard(fixture('error-range')), []);
  const [match] = parseScoreboard(fixture('top14-202611'), 'top14');
  const raw = structuredClone(fixture('top14-202611').events[0]);
  delete raw.competitions[0].venue;
  raw.competitions[0].competitors[0].score = '';
  const [bare] = parseScoreboard({ events: [raw] }, 'top14');
  assert.equal(bare.venue, '');
  assert.equal(bare.home.score, null);
  assert.equal(bare.id, match.id);
});

test('teams of a competition, ids shared across competitions', () => {
  const top14 = parseTeams(fixture('teams-270559'));
  const cup = parseTeams(fixture('teams-271937'));
  assert.equal(top14.length, 14);
  assert.equal(cup.length, 24);
  assert.deepEqual(
    top14.find((team) => team.id === TOULOUSE),
    { id: TOULOUSE, name: 'Stade Toulousain', abbreviation: 'STA' },
  );
  assert.ok(cup.some((team) => team.id === TOULOUSE));
  assert.deepEqual(
    parseTeams(fixture('teams-180659'))
      .map((team) => team.name)
      .sort(),
    ['England', 'France', 'Ireland', 'Italy', 'Scotland', 'Wales'],
  );
});

test('standings: a league, and a cup in pools', () => {
  const top14 = parseStandings(fixture('standings-270559-2027'));
  assert.equal(top14.length, 14);
  assert.deepEqual(
    top14.find((row) => row.teamId === TOULOUSE),
    {
      teamId: TOULOUSE,
      rank: 1,
      points: 32,
      played: 9,
      group: '',
    },
  );
  const cup = parseStandings(fixture('standings-271937-2027'));
  assert.equal(cup.length, 24);
  assert.ok(cup.every((row) => /^Pool [1-4]$/.test(row.group)));
  assert.deepEqual(parseStandings({}), []);
});

test('the client: errors named, requests spaced, never two at once', async () => {
  const answers = [
    () => ({ ok: false, status: 500, json: async () => fixture('error-schedule') }),
    () => ({ ok: false, status: 429, json: async () => ({}) }),
    () => {
      throw new Error('getaddrinfo ENOTFOUND');
    },
    () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }),
    () => ({ ok: true, status: 200, json: async () => ({ events: [] }) }),
  ];
  const urls = [];
  const waits = [];
  const espn = createEspn({
    fetch: async (url) => {
      urls.push(url);
      return answers.shift()();
    },
    sleep: async (ms) => waits.push(ms),
    now: () => 1000,
  });
  const results = await Promise.allSettled(
    [1, 2, 3, 4, 5].map(() => espn.get('/site/v2/sports/rugby/270559/teams')),
  );
  assert.deepEqual(
    results.map((result) => result.reason?.message ?? 'ok'),
    [
      'ESPN answered HTTP 500',
      'ESPN answered HTTP 429 (rate limited)',
      'ESPN unreachable: getaddrinfo ENOTFOUND',
      'ESPN sent something that is not JSON',
      'ok',
    ],
  );
  assert.equal(results[0].reason.status, 500);
  assert.equal(urls[0], 'https://site.api.espn.com/apis/site/v2/sports/rugby/270559/teams');
  assert.equal(waits.length, 4, 'every request after the first one waits');
});

test('the months read: last month to three months ahead, in ESPN time', () => {
  assert.deepEqual(calendarMonths(Date.parse('2026-11-14T10:00:00Z')), [
    '202610',
    '202611',
    '202612',
    '202701',
    '202702',
  ]);
  // 1 January 02:00 UTC is still 31 December in New York.
  assert.deepEqual(calendarMonths(Date.parse('2027-01-01T02:00:00Z')), [
    '202611',
    '202612',
    '202701',
    '202702',
    '202703',
  ]);
});
