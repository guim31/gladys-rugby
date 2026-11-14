// -----------------------------------------------------------------------------
// A running integration against the SDK's fake Gladys, with a clock the test
// moves, ESPN served from answers recorded on 2026-11-14 (test/fixtures/espn)
// and /data kept in memory. No network.
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { createEspn } from '../../src/espn.js';
import { localDate } from '../../src/time.js';

const ALIASES = { 270559: 'top14', 271937: 'cc', 180659: 'sixnations', 17567: 'nc' };

/** A recorded answer of ESPN, or null. */
export function fixture(name) {
  const url = new URL(`../fixtures/espn/${name}.json`, import.meta.url);
  return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null;
}

export const TOULOUSE = '25922';
export const SCOTLAND = '2';
// Lyon – Stade Toulousain, Top 14, 2026-11-28 20:00Z.
export const LYON_TOULOUSE = '604428';

/**
 * A fetch serving the recorded answers, counting the calls. A day scoreboard
 * is cut from the month one (ESPN files matches by their US Eastern date).
 * `api.patch(eventId, fn)` changes a match everywhere it is served (a match
 * that starts, scores, ends); `fail` makes every request a network error,
 * `status` answers that HTTP status instead.
 */
export function fakeEspn({ fail = false, status = 200 } = {}) {
  const months = new Map();
  const patches = new Map();
  const month = (alias, yyyymm) => {
    const key = `${alias}-${yyyymm}`;
    if (!months.has(key)) {
      months.set(key, fixture(key) ?? { events: [] });
    }
    return months.get(key);
  };
  const patched = (body) => {
    const copy = structuredClone(body);
    for (const event of copy.events ?? []) {
      patches.get(String(event.id))?.(event.competitions[0], event);
    }
    return copy;
  };
  const answer = (path) => {
    const match = path.match(
      /^\/site\/v2\/sports\/rugby\/(\d+)\/(scoreboard|teams)(?:\?dates=(\d+))?$/,
    );
    if (match) {
      const [, league, kind, dates] = match;
      const alias = ALIASES[league];
      if (kind === 'teams') {
        return fixture(`teams-${league}`) ?? { sports: [{ leagues: [{ teams: [] }] }] };
      }
      if (dates.length === 6) {
        return patched(month(alias, dates));
      }
      const body = month(alias, dates.slice(0, 6));
      const day = `${dates.slice(0, 4)}-${dates.slice(4, 6)}-${dates.slice(6)}`;
      return patched({
        ...body,
        events: body.events.filter(
          (event) => localDate(Date.parse(event.date), 'America/New_York') === day,
        ),
      });
    }
    const standings = path.match(/^\/v2\/sports\/rugby\/(\d+)\/standings\?season=(\d+)$/);
    if (standings) {
      return fixture(`standings-${standings[1]}-${standings[2]}`);
    }
    return null;
  };
  const api = {
    calls: [],
    fail,
    status,
    patch(eventId, fn) {
      patches.set(eventId, fn);
    },
    fetch: async (url) => {
      const { pathname, search } = new URL(url);
      const path = pathname.replace(/^\/apis/, '') + search;
      api.calls.push(path);
      if (api.fail) {
        throw new Error('getaddrinfo ENOTFOUND site.api.espn.com');
      }
      const body = answer(path);
      if (!body) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return { ok: api.status === 200, status: api.status, json: async () => body };
    },
  };
  return api;
}

/** Sets a match "being played" (or over) with a score, the ESPN way. */
export function play(game, { state, home, away, completed = state === 'post' }) {
  game.status.type.state = state;
  game.status.type.completed = completed;
  game.status.type.name = completed
    ? 'STATUS_FINAL'
    : state === 'in'
      ? 'STATUS_FIRST_HALF'
      : 'STATUS_SCHEDULED';
  const [first, second] = game.competitors;
  first.score = String(home);
  second.score = String(away);
  if (completed) {
    first.winner = home > away;
    second.winner = away > home;
  }
}

export function createMemoryStore(files = {}) {
  const content = new Map(Object.entries(files));
  return {
    files: content,
    load: (name) => (content.has(name) ? structuredClone(content.get(name)) : null),
    save: (name, value) => content.set(name, structuredClone(value)),
  };
}

/** A clock the test sets and moves. */
export function createClock(iso) {
  const clock = {
    ms: Date.parse(iso),
    now: () => clock.ms,
    set: (value) => {
      clock.ms = Date.parse(value);
    },
    advance: (ms) => {
      clock.ms += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] the configuration saved in Gladys
 * @param {string[]} [options.follow] ESPN ids of the teams added in Gladys
 * @param {string} [options.at] the instant of the start (ISO)
 * @param {string} [options.timeZone] Gladys' time zone
 * @param {object} [options.api] fakeEspn()
 * @param {object} [options.store] createMemoryStore()
 * @param {boolean} [options.connect] false: handlers registered, not started
 * @param {boolean} [options.timers] true: the real clock of the service runs,
 *   on Date.now and setTimeout (to mock with t.mock.timers)
 */
export async function createWorld({
  config = {},
  follow = [TOULOUSE],
  at = '2026-11-14T10:00:00Z',
  timeZone = 'Europe/Paris',
  api = fakeEspn(),
  store = createMemoryStore(),
  connect = true,
  timers = false,
} = {}) {
  const clock = createClock(at);
  const selector = 'rugby';
  const devices = follow.map((id) => ({
    name: `Rugby · team ${id}`,
    external_id: `ext:${selector}:team:${id}`,
    features: [],
  }));
  const gladys = createFakeGladys({ config, devices, selector });
  const app = registerHandlers(gladys, {
    store,
    api: createEspn({ fetch: api.fetch, sleep: async () => {}, now: () => 0 }),
    now: timers ? () => Date.now() : clock.now,
    timeZone,
    timers,
  });
  if (connect) {
    await gladys.connect();
  }
  const { service } = app;
  return {
    gladys,
    app,
    service,
    clock,
    api,
    store,
    /** The last value Gladys received for a feature of a team. */
    state(key, teamId = TOULOUSE) {
      return gladys.fake.lastState(`ext:${selector}:team:${teamId}:${key}`);
    },
    /** Moves the clock minute by minute up to an instant, ticking each minute. */
    async runUntil(iso) {
      const target = Date.parse(iso);
      while (clock.ms < target) {
        clock.advance(Math.min(60_000, target - clock.ms));
        await service.tick();
      }
    },
  };
}
