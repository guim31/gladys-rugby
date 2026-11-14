// -----------------------------------------------------------------------------
// The heart of the integration: the matches read from ESPN, kept in a cache in
// /data, and the clock that turns them into device states and scene events.
//
// The clock ticks every minute (Gladys never polls the devices, should_poll
// is false). ESPN is an unofficial API, read sparingly:
// - the teams of each chosen competition once a day (the Discover tab);
// - the matches of each chosen competition every 6 hours, five months at a
//   time (last month to three months ahead): five requests;
// - the standings every 6 hours, and again after a match of a followed team,
//   only for the competitions where a followed team plays;
// - the scoreboard of the day every minute, only from 5 minutes before the
//   kick-off of a followed team's match until ESPN says it is over (4 hours
//   at most).
// The scene events come from what ESPN reports: "kick-off" when a match of a
// followed team goes from "to come" to "being played", "match finished" when
// it is over; "match starting" follows the clock and the scheduled kick-off.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { competition } from './competitions.js';
import { buildDevice, buildStates, describeMatch, teamIdOf } from './device.js';
import { PATHS, parseScoreboard, parseStandings, parseTeams } from './espn.js';
import { createFailureLog } from './failures.js';
import { PROBLEM_TEXT, SENTENCES, teamName } from './i18n.js';
import { isFinished, isLiveWindow, resultOf, sides, teamMatches } from './matches.js';
import { formatTime, localDate, processTimeZone } from './time.js';

const logger = createLogger({ name: 'rugby' });

export const WIDGET_KEY = 'rugby_team';

// Trigger keys are forever: scenes store them.
export const TRIGGERS = {
  MATCH_STARTING: 'match_starting',
  KICKOFF: 'kickoff',
  MATCH_FINISHED: 'match_finished',
};

// The lead times the "match starting" filter offers, in minutes.
export const LEAD_MINUTES = [15, 30, 60, 120];
export const RESULTS = ['win', 'draw', 'loss'];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MAX_AGE = { teams: DAY, calendar: 6 * HOUR, standings: 6 * HOUR };
const LIVE_INTERVAL = MINUTE;
const RETRY_AFTER = 10 * MINUTE;
const LIVE_RETRY_AFTER = 2 * MINUTE;
const HEARTBEAT = 12 * HOUR;
// After a restart, the "match starting" of the last minutes are still fired.
const CATCH_UP = 10 * MINUTE;
// A transition seen later than this after the kick-off is not announced (an
// integration stopped for days does not fire old matches when it restarts).
const ANNOUNCE_WITHIN = { kickoff: 2 * HOUR, finished: 12 * HOUR };
const SEEN_KEPT = 30 * DAY;
const STATE_ORDER = { pre: 0, in: 1, finished: 2, post: 2 };
const KEEP_RESULTS = 183 * DAY;
// ESPN files a match under its date in US Eastern time (a 00:00Z kick-off is
// on the previous day).
const ESPN_TIME_ZONE = 'America/New_York';

const CACHE_FILE = 'cache.json';
const TRIGGERS_FILE = 'triggers.json';

/** 'YYYYMM' of the months ESPN is asked for: last month to three months ahead. */
export function calendarMonths(now) {
  const [year, month] = localDate(now, ESPN_TIME_ZONE).split('-').map(Number);
  const months = [];
  for (let offset = -1; offset <= 3; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    months.push(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function espnDay(ms) {
  return localDate(ms, ESPN_TIME_ZONE).replaceAll('-', '');
}

export class RugbyService {
  /**
   * @param {object} options
   * @param {object} options.gladys the SDK client
   * @param {object} options.store JSON files in /data (src/store.js)
   * @param {object} options.api the ESPN client (src/espn.js)
   * @param {Function} [options.now] the clock (tests)
   * @param {string} [options.timeZone] Gladys' time zone (default: TZ)
   * @param {boolean} [options.timers] false in the tests: they call tick()
   */
  constructor({ gladys, store, api, now = Date.now, timeZone, timers = true }) {
    this.gladys = gladys;
    this.store = store;
    this.api = api;
    this.now = now;
    this.timeZone = timeZone ?? processTimeZone();
    this.timers = timers;
    this.config = null;
    this.data = { teams: {}, calendar: {}, standings: {} };
    this.liveFetchedAt = {};
    this.apiError = null;
    this.failedRefreshes = 0;
    this.lastAttempt = 0;
    this.standingsFailedAt = {};
    this.seen = {};
    // "Match starting" events sent while a later one of the same minute was
    // refused: not sent twice when the interval is checked again.
    this.startingSent = new Set();
    this.lastCheck = 0;
    this.lastForce = 0;
    this.statusKey = null;
    this.widgetKey = null;
    this.timer = null;
    this.queue = Promise.resolve();
    // A failure repeated every minute is logged once (src/failures.js).
    this.failures = createFailureLog(logger);
  }

  // One operation at a time: a tick never interleaves with a reconfiguration.
  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  start(config) {
    return this.serial(async () => {
      this.config = config;
      this.loadCache();
      const saved = this.store.load(TRIGGERS_FILE);
      const now = this.now();
      this.seen = saved?.seen ?? {};
      this.lastCheck = saved ? Math.max(saved.lastCheck ?? 0, now - CATCH_UP) : now;
      // The clock runs whatever happens below: a failure at start-up must not
      // stop the readings and the triggers until the next restart.
      this.schedule();
      await this.refresh();
      await this.publishDevices();
      await this.publishStates({ force: true });
      await this.updateStatus();
      this.refreshWidget();
      await this.fireStartingTriggers();
    });
  }

  /** The configuration changed (language, competitions). */
  reconfigure(config) {
    return this.serial(async () => {
      const added = config.competitions.some((key) => !this.config?.competitions.includes(key));
      this.config = config;
      this.dropUnticked();
      if (added) {
        await this.refresh();
      }
      await this.publishDevices();
      await this.publishStates({ force: true });
      await this.updateStatus({ force: true });
      this.refreshWidget();
    });
  }

  /** Gladys came back (restart): it may have lost what was sent meanwhile. */
  resync(config) {
    return this.reconfigure(config);
  }

  /** The user added a team: its states were dropped until now. */
  deviceCreated() {
    return this.serial(async () => {
      // Its matches are now watched: what ESPN says of them is the reference.
      await this.detectTransitions(this.now(), { announce: false });
      await this.refresh();
      await this.publishStates({ force: true });
      this.refreshWidget();
    });
  }

  /** A team renamed or removed: the widget shows the names given in Gladys. */
  deviceChanged() {
    this.refreshWidget();
  }

  /** "Check" on the Configuration screen: everything read again now. */
  check() {
    return this.serial(async () => {
      const ok = await this.refresh({ force: true });
      await this.publishDevices();
      await this.publishStates();
      await this.updateStatus();
      this.refreshWidget();
      return ok;
    });
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
    return this.queue;
  }

  schedule() {
    if (!this.timers) {
      return;
    }
    clearTimeout(this.timer);
    // Just after the next minute: a match kicking off at :00 is seen at :00.
    const delay = MINUTE - (this.now() % MINUTE) + 500;
    this.timer = setTimeout(() => {
      this.tick()
        .then(() => this.failures.succeeded('tick', 'The clock works again'))
        .catch((err) => this.failures.failed('tick', 'Clock tick failed', err))
        .finally(() => this.schedule());
    }, delay);
    this.timer.unref?.();
  }

  /** One step of the clock. */
  tick() {
    return this.serial(async () => {
      const teamsBefore = this.teamsSignature();
      if (await this.refresh()) {
        await this.updateStatus();
      }
      if (this.teamsSignature() !== teamsBefore) {
        await this.publishDevices();
      }
      await this.publishStates({ force: this.now() - this.lastForce >= HEARTBEAT });
      await this.fireStartingTriggers();
      // The countdown and the score of the widget follow the clock.
      if (this.widgetSignature() !== this.widgetKey) {
        this.refreshWidget();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Followed teams
  // ---------------------------------------------------------------------------

  /** The ESPN ids of the teams the user added in Gladys. */
  followedTeams() {
    const ids = (this.gladys.devices ?? []).map((device) =>
      teamIdOf(this.gladys, device.external_id),
    );
    return [...new Set(ids.filter(Boolean))];
  }

  /** The name a team has in Gladys (the device name), else ESPN's. */
  gladysName(teamId) {
    const ids = this.gladys.externalIds('team', teamId);
    const device = (this.gladys.devices ?? []).find((entry) => entry.external_id === ids.device);
    return device?.name ?? null;
  }

  /** Every team of the chosen competitions, each once, by name. */
  availableTeams() {
    const byId = new Map();
    for (const key of this.config.competitions) {
      for (const team of this.data.teams[key]?.teams ?? []) {
        byId.set(team.id, team);
      }
    }
    // A followed team stays offered when its competition is unticked.
    for (const teamId of this.followedTeams()) {
      if (!byId.has(teamId)) {
        const team = this.findTeam(teamId);
        if (team) {
          byId.set(teamId, team);
        }
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  findTeam(teamId) {
    for (const entry of Object.values(this.data.teams)) {
      const team = entry.teams?.find((candidate) => candidate.id === teamId);
      if (team) {
        return team;
      }
    }
    for (const entry of Object.values(this.data.calendar)) {
      for (const match of entry.matches ?? []) {
        for (const side of [match.home, match.away]) {
          if (side.id === teamId) {
            return { id: side.id, name: side.name, abbreviation: side.abbreviation };
          }
        }
      }
    }
    return null;
  }

  teamsSignature() {
    return this.config.competitions
      .map((key) => (this.data.teams[key]?.teams ?? []).map((team) => team.id).join(','))
      .join('|');
  }

  // ---------------------------------------------------------------------------
  // ESPN and its cache
  // ---------------------------------------------------------------------------

  loadCache() {
    const cache = this.store.load(CACHE_FILE);
    if (cache?.version !== 1) {
      return;
    }
    for (const kind of ['teams', 'calendar', 'standings']) {
      const entries = cache[kind];
      if (entries && typeof entries === 'object') {
        this.data[kind] = entries;
      }
    }
    this.dropUnticked();
  }

  /**
   * Matches and standings of an unticked competition are no longer read: they
   * are dropped rather than shown stale (a ticked-again competition is read
   * again at once). The teams stay, for the names of the followed ones.
   */
  dropUnticked() {
    for (const kind of ['calendar', 'standings']) {
      for (const key of Object.keys(this.data[kind])) {
        if (!this.config.competitions.includes(key)) {
          delete this.data[kind][key];
        }
      }
    }
  }

  saveCache() {
    this.store.save(CACHE_FILE, { version: 1, ...this.data });
  }

  isDue(kind, key, now) {
    const fetched = this.data[kind][key]?.fetched_at;
    return !fetched || now - fetched >= MAX_AGE[kind];
  }

  /** The competitions and days to read live now: [{ key, day }]. */
  liveReadings(now) {
    const due = new Map();
    for (const teamId of this.followedTeams()) {
      for (const match of teamMatches(this.data, teamId)) {
        if (!competition(match.competition) || !isLiveWindow(match, now)) {
          continue;
        }
        const day = espnDay(match.start);
        const id = `${match.competition}:${day}`;
        if (now - (this.liveFetchedAt[id] ?? 0) >= LIVE_INTERVAL - 5_000) {
          due.set(id, { key: match.competition, day, id });
        }
      }
    }
    return [...due.values()];
  }

  /**
   * The standings due: the competitions where a followed team plays, every
   * 6 hours and after one of their matches ended. The season is the one of
   * the matches (ESPN's default season can be years old).
   */
  standingsDue(now, force) {
    const followed = new Set(this.followedTeams());
    const due = [];
    for (const key of this.config.competitions) {
      const matches = this.data.calendar[key]?.matches ?? [];
      const played = matches.filter(
        (match) => followed.has(match.home.id) || followed.has(match.away.id),
      );
      const seasons = matches.filter(isFinished).map((match) => match.season);
      const season = seasons.length > 0 ? Math.max(...seasons.filter(Number.isInteger)) : null;
      if (played.length === 0 || !Number.isInteger(season)) {
        continue;
      }
      if (!force && now - (this.standingsFailedAt[key] ?? 0) < RETRY_AFTER) {
        continue;
      }
      const held = this.data.standings[key];
      const ended = played.some(
        (match) => isFinished(match) && held && match.start + 2 * HOUR > held.fetched_at,
      );
      if (
        force ||
        !held ||
        held.season !== season ||
        now - held.fetched_at >= MAX_AGE.standings ||
        (ended && now - held.fetched_at >= 30 * MINUTE)
      ) {
        due.push({ key, season });
      }
    }
    return due;
  }

  /**
   * Reads what is due (everything with `force`).
   * @returns {Promise<boolean>} true when something was read or failed: the
   *   connection status may have changed
   */
  async refresh({ force = false } = {}) {
    const now = this.now();
    const live = this.liveReadings(now);
    if (
      !force &&
      this.apiError &&
      now - this.lastAttempt < (live.length > 0 ? LIVE_RETRY_AFTER : RETRY_AFTER)
    ) {
      return false;
    }
    const tasks = [];
    for (const key of this.config.competitions) {
      if (force || this.isDue('teams', key, now)) {
        tasks.push({ kind: 'teams', key });
      }
      if (force || this.isDue('calendar', key, now)) {
        tasks.push({ kind: 'calendar', key });
      }
    }
    // A full calendar read already holds the day.
    const calendars = new Set(tasks.filter((task) => task.kind === 'calendar').map((t) => t.key));
    for (const reading of live) {
      if (!calendars.has(reading.key)) {
        tasks.push({ kind: 'live', ...reading });
      }
    }
    if (tasks.length === 0 && this.standingsDue(now, false).length === 0) {
      return false;
    }
    this.lastAttempt = now;
    let read = 0;
    let error = null;
    // One failing document does not hold the others back; an unreachable or
    // rate-limiting ESPN stops the round (no point in hammering it).
    const attempt = async (fn) => {
      try {
        await fn();
        read += 1;
        return true;
      } catch (err) {
        error ??= err;
        return Boolean(err.status) && err.status !== 429;
      }
    };
    let go = true;
    for (const task of tasks) {
      go = await attempt(() => this.read(task, now));
      if (!go) {
        break;
      }
    }
    // After the matches: the season and the ended matches decide.
    if (go) {
      for (const { key, season } of this.standingsDue(now, force)) {
        if (!(await attempt(() => this.readStandings(key, season, now)))) {
          break;
        }
      }
    }
    if (error) {
      this.apiError = error.message;
      this.failedRefreshes += 1;
      this.failures.failed('api', `Could not read ESPN: ${error.message}`);
    } else {
      this.apiError = null;
      this.failedRefreshes = 0;
      this.failures.succeeded('api', 'ESPN read again');
    }
    if (read > 0) {
      this.saveCache();
      logger.debug(`Read ${read} ESPN documents`);
    }
    await this.detectTransitions(now);
    return true;
  }

  async read(task, now) {
    const league = competition(task.key).espn;
    if (task.kind === 'teams') {
      const teams = parseTeams(await this.api.get(PATHS.teams(league)));
      this.data.teams[task.key] = { fetched_at: now, teams };
      return;
    }
    if (task.kind === 'calendar') {
      // Finished matches before the months read are kept half a year: the
      // last result of a team between two seasons (the Six Nations in April).
      const months = calendarMonths(now);
      const from = Date.UTC(Number(months[0].slice(0, 4)), Number(months[0].slice(4)) - 1, 1);
      const byId = new Map(
        (this.data.calendar[task.key]?.matches ?? [])
          .filter(
            (match) => isFinished(match) && match.start < from && now - match.start < KEEP_RESULTS,
          )
          .map((match) => [match.id, match]),
      );
      for (const month of months) {
        const body = await this.api.get(PATHS.scoreboard(league, month));
        for (const match of parseScoreboard(body, task.key)) {
          byId.set(match.id, match);
        }
      }
      this.data.calendar[task.key] = {
        fetched_at: now,
        matches: [...byId.values()].sort((a, b) => a.start - b.start),
      };
      return;
    }
    // live: the matches of the day replace their entries of the calendar.
    this.liveFetchedAt[task.id] = now;
    const matches = parseScoreboard(
      await this.api.get(PATHS.scoreboard(league, task.day)),
      task.key,
    );
    const entry = this.data.calendar[task.key] ?? { fetched_at: 0, matches: [] };
    const byId = new Map(entry.matches.map((match) => [match.id, match]));
    for (const match of matches) {
      byId.set(match.id, match);
    }
    entry.matches = [...byId.values()].sort((a, b) => a.start - b.start);
    this.data.calendar[task.key] = entry;
  }

  /** Standings are a bonus: a competition without them is not an ESPN failure. */
  async readStandings(key, season, now) {
    try {
      const body = await this.api.get(PATHS.standings(competition(key).espn, season));
      this.data.standings[key] = { fetched_at: now, season, rows: parseStandings(body) };
      this.failures.succeeded(`standings:${key}`);
    } catch (err) {
      if (!err.status || err.status === 429) {
        throw err;
      }
      // An answer ESPN cannot give (a 4xx, a 500 on a route it does not
      // serve) keeps the standings held, and is tried again later.
      this.standingsFailedAt[key] = now;
      this.failures.failed(`standings:${key}`, `No standings for ${key}: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Gladys side
  // ---------------------------------------------------------------------------

  async publishDevices() {
    const devices = this.availableTeams().map((team) =>
      buildDevice(this.gladys, this.config, team),
    );
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.failures.succeeded('devices', 'Teams published again');
    } catch (err) {
      this.failures.failed('devices', `Could not publish the teams: ${err.message}`);
    }
  }

  /**
   * Publishes the states that changed, or all of them (`force`), for the
   * followed teams. A failure is logged: the next publication sends again
   * what Gladys did not accept.
   */
  async publishStates({ force = false } = {}) {
    if (force) {
      this.gladys.forgetPublishedStates();
      this.lastForce = this.now();
    }
    const at = { now: this.now(), timeZone: this.timeZone };
    const states = this.followedTeams().flatMap((teamId) =>
      buildStates(this.gladys, this.config, this.data, teamId, at),
    );
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states);
      this.failures.succeeded('states', 'States published again');
    } catch (err) {
      this.failures.failed('states', `Could not publish the states: ${err.message}`);
    }
  }

  problems() {
    const found = [];
    if (this.config.competitions.length === 0) {
      found.push('noCompetition');
    }
    // One failed reading with data held is a hiccup, not an outage.
    const held = Object.keys(this.data.calendar).length > 0;
    if (this.apiError && (this.failedRefreshes >= 2 || !held)) {
      found.push('unreachable');
    }
    return found;
  }

  /** Reports the status when it changed (or always, with `force`). */
  async updateStatus({ force = false } = {}) {
    const problems = this.problems();
    const key = problems.join(',');
    if (!force && key === this.statusKey) {
      return;
    }
    const message =
      problems.length === 0
        ? undefined
        : Object.fromEntries(
            ['en', 'fr', 'de', 'es'].map((language) => [
              language,
              problems.map((problem) => PROBLEM_TEXT[problem][language]).join(' '),
            ]),
          );
    try {
      await this.gladys.setConnectionStatus(problems.length === 0, message);
      this.statusKey = key;
      this.failures.succeeded('status', 'Status reported again');
    } catch (err) {
      this.failures.failed('status', `Could not report the status: ${err.message}`);
    }
  }

  widgetSignature() {
    const now = this.now();
    const parts = [];
    let soon = false;
    for (const teamId of this.followedTeams()) {
      for (const match of teamMatches(this.data, teamId)) {
        if (match.start > now - DAY && match.start < now + 2 * DAY) {
          parts.push(match.id, match.state, match.home.score, match.away.score);
          soon ||= match.start > now && match.start < now + DAY;
        }
      }
    }
    // The countdown shows hours, and minutes under a day.
    parts.push(Math.floor(now / (soon ? 5 * MINUTE : HOUR)));
    return parts.join('|');
  }

  refreshWidget() {
    this.widgetKey = this.widgetSignature();
    try {
      // Fire-and-forget, rate-limited by the core: never awaited.
      Promise.resolve(this.gladys.requestWidgetRefresh(WIDGET_KEY)).catch(() => {});
    } catch {
      // Disconnected: the widget refetches on its own TTL.
    }
  }

  /** @returns {Promise<boolean>} false when Gladys refused the event */
  async fireEvent(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      this.failures.succeeded('scene-event', 'Scene triggers fired again');
      return true;
    } catch (err) {
      this.failures.failed('scene-event', `Could not fire ${key}: ${err.message}`);
      return false;
    }
  }

  /** The variables every match event shares. */
  eventData(match, teamId) {
    const language = this.config.language;
    const words = describeMatch(match, teamId, language, this.timeZone, this.now());
    const { team, opponent } = sides(match, teamId);
    return {
      device: this.gladys.externalIds('team', teamId).device,
      team: words.team,
      opponent: words.opponent,
      competition: words.competition,
      home: words.home,
      team_score: team.score ?? 0,
      opponent_score: opponent.score ?? 0,
      kickoff_time: match.timed ? formatTime(match.start, language, this.timeZone) : '',
      venue: words.venue,
      words,
    };
  }

  /**
   * "Kick-off" and "match finished": what ESPN says of a followed team's
   * match, compared with what it said before. Per match and team, `seen`
   * holds the furthest state reached (a stale document saying "to come"
   * again never goes back), whether it was seen "to come" or "being played",
   * and which events were sent: each fires once, and is tried again at the
   * next reading while Gladys refuses it. A match seen for the first time
   * already started or over is only noted (a fresh install, a team added).
   */
  async detectTransitions(now, { announce = true } = {}) {
    const sentences = SENTENCES[this.config.language];
    const seenNow = {};
    const due = [];
    for (const teamId of this.followedTeams()) {
      for (const match of teamMatches(this.data, teamId)) {
        const id = `${teamId}:${match.id}`;
        const state = isFinished(match) ? 'finished' : match.state;
        const before = this.seen[id];
        const entry = before
          ? { ...before, start: match.start }
          : { state, start: match.start, sawPre: state === 'pre', sawLive: state === 'in' };
        if (before && STATE_ORDER[state] > STATE_ORDER[before.state]) {
          entry.state = state;
        }
        entry.sawLive ||= entry.state === 'in';
        seenNow[id] = entry;
        if (!announce) {
          continue;
        }
        const age = now - match.start;
        if (entry.state === 'in' && entry.sawPre && !entry.kickoff) {
          if (age <= ANNOUNCE_WITHIN.kickoff) {
            due.push({ id, flag: 'kickoff', key: TRIGGERS.KICKOFF, match, teamId });
          } else {
            entry.kickoff = true;
          }
        }
        if (entry.state === 'finished' && (entry.sawPre || entry.sawLive) && !entry.finished) {
          // A kick-off missed meanwhile is not announced after the end.
          entry.kickoff = true;
          if (age <= ANNOUNCE_WITHIN.finished && resultOf(match, teamId)) {
            due.push({ id, flag: 'finished', key: TRIGGERS.MATCH_FINISHED, match, teamId });
          } else {
            entry.finished = true;
          }
        }
      }
    }
    // Matches no longer read (another month, an unticked competition) are
    // kept a while: they come back with the next reading.
    for (const [id, entry] of Object.entries(this.seen)) {
      if (!seenNow[id] && now - entry.start < SEEN_KEPT) {
        seenNow[id] = entry;
      }
    }
    this.seen = seenNow;
    for (const { id, flag, key, match, teamId } of due) {
      const { words, ...data } = this.eventData(match, teamId);
      if (key === TRIGGERS.KICKOFF) {
        data.sentence = sentences.kickoff(words);
      } else {
        data.result = resultOf(match, teamId);
        data.sentence = sentences.last({
          team: data.team,
          opponent: data.opponent,
          teamScore: data.team_score,
          opponentScore: data.opponent_score,
          result: data.result,
          competition: data.competition,
        });
      }
      if (await this.fireEvent(key, data)) {
        this.seen[id][flag] = true;
      }
    }
    this.saveTriggers();
  }

  /** "Match starting": every (match, lead time) reached since the last check. */
  async fireStartingTriggers() {
    const now = this.now();
    const from = this.lastCheck;
    if (now <= from) {
      return; // the clock stepped back: this interval was already checked
    }
    this.lastCheck = now;
    const sentences = SENTENCES[this.config.language];
    const events = [];
    for (const teamId of this.followedTeams()) {
      for (const match of teamMatches(this.data, teamId)) {
        if (!match.timed || match.state !== 'pre') {
          continue;
        }
        for (const lead of LEAD_MINUTES) {
          const at = match.start - lead * MINUTE;
          const sent = `${teamId}:${match.id}:${lead}`;
          if (at > from && at <= now && !this.startingSent.has(sent)) {
            const { words, ...data } = this.eventData(match, teamId);
            events.push({
              at,
              sent,
              data: {
                ...data,
                minutes_before: String(lead),
                sentence: sentences.startingSoon({ ...words, time: data.kickoff_time }, lead),
              },
            });
          }
        }
      }
    }
    events.sort((a, b) => a.at - b.at);
    let refused = false;
    for (const event of events) {
      if (!(await this.fireEvent(TRIGGERS.MATCH_STARTING, event.data))) {
        // Gladys is unavailable: try again from this event at the next tick,
        // for 10 minutes at most.
        this.lastCheck = Math.max(event.at - 1, now - CATCH_UP);
        refused = true;
        break;
      }
      this.startingSent.add(event.sent);
    }
    if (!refused) {
      this.startingSent.clear();
    }
    this.saveTriggers();
  }

  saveTriggers() {
    this.store.save(TRIGGERS_FILE, { lastCheck: this.lastCheck, seen: this.seen });
  }

  /** For "Check": the competitions read. */
  summary() {
    return this.config.competitions.map((key) => ({
      key,
      matches: this.data.calendar[key]?.matches.length ?? 0,
      teams: this.data.teams[key]?.teams.length ?? 0,
    }));
  }

  teamLabel(teamId, language) {
    const team = this.findTeam(teamId);
    return team ? teamName(team, language) : teamId;
  }
}
