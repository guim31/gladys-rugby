// -----------------------------------------------------------------------------
// ESPN's public JSON API (site.api.espn.com): no account, no key, but neither
// official nor documented. What was checked in November 2026, and what the
// integration relies on:
// - /scoreboard?dates=YYYYMM (a month) and ?dates=YYYYMMDD (a day) answer;
//   a range of dates is a 400, and /teams/<id>/schedule a 500 for rugby;
// - /teams lists the teams of a competition, sometimes last season's (the
//   service completes it from the calendar); team ids are shared by every
//   competition (Stade Toulousain is 25922 in the Top 14 and the Champions Cup);
// - /standings (apis/v2) needs ?season=<year of the events>: without it, an
//   old season comes back.
// Every field may be missing: the parsers keep what they understand and drop
// the rest, never guess.
// -----------------------------------------------------------------------------

export const API_BASE = 'https://site.api.espn.com/apis';

const REQUEST_TIMEOUT_MS = 10_000;
// A courtesy towards an API nobody granted us: one request at a time, spaced.
const MIN_SPACING_MS = 300;
const USER_AGENT = 'gladys-rugby (+https://github.com/guim31/gladys-rugby)';

export const PATHS = {
  scoreboard: (league, dates) => `/site/v2/sports/rugby/${league}/scoreboard?dates=${dates}`,
  teams: (league) => `/site/v2/sports/rugby/${league}/teams`,
  standings: (league, season) => `/v2/sports/rugby/${league}/standings?season=${season}`,
};

export class EspnError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'EspnError';
    this.status = status;
  }
}

/**
 * @param {object} [options]
 * @param {Function} [options.fetch] the global fetch by default (tests inject one)
 * @param {Function} [options.sleep] waits between requests (tests skip it)
 * @param {Function} [options.now] the clock used for the spacing
 */
export function createEspn({
  fetch = globalThis.fetch,
  sleep = defaultSleep,
  now = Date.now,
} = {}) {
  let last = 0;
  let queue = Promise.resolve();
  const get = async (path) => {
    const wait = last + MIN_SPACING_MS - now();
    if (wait > 0) {
      await sleep(wait);
    }
    last = now();
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new EspnError(`ESPN unreachable: ${err.message}`);
    }
    if (!response.ok) {
      const reason = response.status === 429 ? ' (rate limited)' : '';
      throw new EspnError(`ESPN answered HTTP ${response.status}${reason}`, response.status);
    }
    try {
      return await response.json();
    } catch {
      throw new EspnError('ESPN sent something that is not JSON');
    }
  };
  return {
    /** GET a path of the API (built with PATHS), the parsed JSON. */
    get(path) {
      const run = queue.then(() => get(path));
      queue = run.catch(() => {});
      return run;
    },
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------------
// Parsers
// -----------------------------------------------------------------------------

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');

function score(value) {
  const number = Number(value);
  return value !== '' && value !== null && Number.isFinite(number) && number >= 0 ? number : null;
}

function parseTeam(raw) {
  const team = raw?.team ?? raw;
  const id = text(String(team?.id ?? ''));
  const name = text(team?.displayName) || text(team?.name) || text(team?.shortDisplayName);
  return id && name ? { id, name, abbreviation: text(team.abbreviation) } : null;
}

/**
 * One match of a scoreboard, or null when it cannot be understood.
 * `state`: 'pre' (to come), 'in' (being played), 'post' (over, or called off:
 * `completed` tells them apart).
 */
export function parseEvent(event, competitionKey) {
  const game = event?.competitions?.[0];
  const start = Date.parse(game?.date ?? event?.date ?? '');
  if (!event?.id || !game || !Number.isFinite(start)) {
    return null;
  }
  const sides = {};
  for (const competitor of game.competitors ?? []) {
    const team = parseTeam(competitor);
    if (team && (competitor.homeAway === 'home' || competitor.homeAway === 'away')) {
      sides[competitor.homeAway] = {
        ...team,
        score: score(competitor.score),
        winner: competitor.winner === true,
      };
    }
  }
  if (!sides.home || !sides.away) {
    return null;
  }
  const status = game.status?.type ?? event.status?.type ?? {};
  const state = ['pre', 'in', 'post'].includes(status.state) ? status.state : 'pre';
  const statusName = text(status.name);
  const venue = game.venue ?? {};
  const broadcasts = [
    text(game.broadcast),
    ...(game.broadcasts ?? []).flatMap((entry) => entry?.names ?? []).map(text),
  ].filter(Boolean);
  return {
    id: String(event.id),
    competition: competitionKey,
    season: Number.isInteger(event.season?.year) ? event.season.year : null,
    start,
    // A kick-off time not set yet comes as midnight UTC, or as STATUS_TBD.
    timed: game.timeValid !== false && statusName !== 'STATUS_TBD',
    state,
    completed: status.completed === true,
    status: statusName,
    home: sides.home,
    away: sides.away,
    venue: text(venue.fullName),
    city: text(venue.address?.city),
    tv: [...new Set(broadcasts)].join(', '),
  };
}

/** The matches of a scoreboard answer. */
export function parseScoreboard(body, competitionKey) {
  return (Array.isArray(body?.events) ? body.events : [])
    .map((event) => parseEvent(event, competitionKey))
    .filter(Boolean);
}

/** The teams of a /teams answer: [{ id, name, abbreviation }]. */
export function parseTeams(body) {
  const teams = body?.sports?.[0]?.leagues?.[0]?.teams;
  return (Array.isArray(teams) ? teams : []).map(parseTeam).filter(Boolean);
}

/**
 * The standings: one row per team, { teamId, rank, points, played, group }.
 * Pools (Champions Cup) are flattened: the rank is the rank in the pool.
 */
export function parseStandings(body) {
  const groups = Array.isArray(body?.children) ? body.children : body?.standings ? [body] : [];
  const rows = [];
  for (const group of groups) {
    for (const entry of group?.standings?.entries ?? []) {
      const team = parseTeam(entry.team);
      const stats = Object.fromEntries(
        (entry.stats ?? []).map((stat) => [stat.name, Number(stat.value)]),
      );
      if (team && Number.isInteger(stats.rank) && stats.rank > 0) {
        rows.push({
          teamId: team.id,
          rank: stats.rank,
          points: Number.isFinite(stats.points) ? stats.points : null,
          played: Number.isFinite(stats.gamesPlayed) ? stats.gamesPlayed : null,
          group: groups.length > 1 ? text(group.name) : '',
        });
      }
    }
  }
  return rows;
}
