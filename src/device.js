// -----------------------------------------------------------------------------
// One device per team: "Rugby · Stade Toulousain". Every team of the chosen
// competitions is offered in the Discover tab; the teams the user adds are
// the followed ones. Every feature shares its type with another one: Gladys
// shows the generic label of the type instead of the feature name when a
// feature is alone of its type.
// -----------------------------------------------------------------------------

import { competitionName } from './competitions.js';
import { NAMES, RESULT_WORDS, STATE_TEXT, teamName } from './i18n.js';
import {
  lastMatch,
  liveMatch,
  nextMatch,
  resultOf,
  sides,
  teamMatches,
  teamRank,
} from './matches.js';
import { daysBetween, formatStart, localDate } from './time.js';

const TEXT = { category: 'text', type: 'text', min: 0, max: 0 };
const BINARY = { category: 'input', type: 'binary', min: 0, max: 1 };
const COUNT = (max) => ({ category: 'counter-sensor', type: 'integer', min: 0, max });

// Feature keys are forever (Gladys keys history and scenes on them).
export const FEATURES = [
  { key: 'next_match', ...TEXT },
  { key: 'next_kickoff', ...TEXT },
  { key: 'next_venue', ...TEXT },
  { key: 'last_result', ...TEXT },
  // -1: no match scheduled.
  {
    key: 'days_until_match',
    category: 'duration',
    type: 'integer',
    unit: 'days',
    min: -1,
    max: 366,
  },
  { key: 'match_live', ...BINARY },
  { key: 'match_today', ...BINARY },
  { key: 'team_score', ...COUNT(200) },
  { key: 'opponent_score', ...COUNT(200) },
  { key: 'rank', ...COUNT(99) },
];

export const DEVICE_TYPE = 'team';

/** The ids of a team's device: the ESPN team id, shared by every competition. */
export function deviceIds(gladys, teamId) {
  return gladys.externalIds(DEVICE_TYPE, teamId);
}

/** The ESPN team id of one of our devices, null for anything else. */
export function teamIdOf(gladys, externalId) {
  const prefix = gladys.externalId(`${DEVICE_TYPE}:`);
  return typeof externalId === 'string' && externalId.startsWith(prefix)
    ? externalId.slice(prefix.length) || null
    : null;
}

/** @param {{ id: string, name: string }} team */
export function buildDevice(gladys, config, team) {
  const ids = deviceIds(gladys, team.id);
  const names = NAMES[config.language];
  return {
    name: names.device(teamName(team, config.language)),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'espn_team_id', value: team.id },
      { name: 'source', value: 'ESPN' },
    ],
    features: FEATURES.map(({ key, category, type, unit, min, max }) => ({
      name: names[key],
      external_id: ids.feature(key),
      category,
      type,
      ...(unit ? { unit } : {}),
      min,
      max,
      read_only: true,
      has_feedback: false,
    })),
  };
}

/** The words of a match from a team's side, for the states and the sentences. */
export function describeMatch(match, teamId, language, timeZone, now) {
  const { team, opponent, home } = sides(match, teamId);
  const day = formatStart({ start: match.start, timed: match.timed }, language, timeZone);
  return {
    team: teamName(team, language),
    opponent: teamName(opponent, language),
    home,
    competition: competitionName(match.competition, language),
    kickoff: day,
    days: Math.max(0, daysBetween(localDate(now, timeZone), localDate(match.start, timeZone))),
    venue: [match.venue, match.city && !match.venue.includes(match.city) ? match.city : '']
      .filter(Boolean)
      .join(', '),
    tv: match.tv,
  };
}

/** "Lyon – Stade Toulousain (Top 14)": home team first, as the fixtures read. */
export function matchTitle(match, language) {
  return `${teamName(match.home, language)} – ${teamName(match.away, language)} (${competitionName(
    match.competition,
    language,
  )})`;
}

/** "Victoire 28-18 contre Clermont Auvergne (Top 14)" */
export function resultText(match, teamId, language) {
  const { team, opponent } = sides(match, teamId);
  const result = resultOf(match, teamId);
  return `${STATE_TEXT[language].result(
    RESULT_WORDS[language][result],
    `${team.score}-${opponent.score}`,
    teamName(opponent, language),
  )} (${competitionName(match.competition, language)})`;
}

/**
 * The states of a team's device at an instant. A value the integration does
 * not know (no match read yet, no standings) is left out, never guessed.
 */
export function buildStates(gladys, config, data, teamId, { now, timeZone }) {
  const ids = deviceIds(gladys, teamId);
  const language = config.language;
  const text = STATE_TEXT[language];
  const states = [];
  const number = (key, value) => {
    if (Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    }
  };
  const string = (key, value) => {
    if (value) {
      states.push({ device_feature_external_id: ids.feature(key), text: String(value) });
    }
  };

  const matches = teamMatches(data, teamId);
  if (Object.keys(data.calendar ?? {}).length > 0) {
    const live = liveMatch(matches);
    const next = nextMatch(matches, now);
    const today = localDate(now, timeZone);
    if (next) {
      const words = describeMatch(next, teamId, language, timeZone, now);
      string('next_match', matchTitle(next, language));
      string('next_kickoff', words.kickoff);
      string(
        'next_venue',
        [words.venue || (words.home ? text.home : text.away), words.tv ? text.tv(words.tv) : '']
          .filter(Boolean)
          .join(' · '),
      );
      number('days_until_match', words.days);
    } else {
      string('next_match', text.none);
      string('next_kickoff', text.none);
      string('next_venue', text.none);
      number('days_until_match', -1);
    }
    number('match_live', live ? 1 : 0);
    number(
      'match_today',
      matches.some(
        (match) =>
          localDate(match.start, timeZone) === today && (match.state !== 'post' || match.completed),
      )
        ? 1
        : 0,
    );
    const last = lastMatch(matches);
    if (last) {
      string('last_result', resultText(last, teamId, language));
    }
    const shown = live ?? last;
    if (shown) {
      const { team, opponent } = sides(shown, teamId);
      number('team_score', team.score ?? 0);
      number('opponent_score', opponent.score ?? 0);
    }
  }
  const rank = teamRank(data, config.competitions, teamId);
  if (rank) {
    number('rank', rank.rank);
  }
  return states;
}
