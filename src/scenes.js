// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): sentences ready to send in a
// message or to say aloud, in the language of the configuration (a scene
// action does not get the user's language), and a few values for conditions.
// -----------------------------------------------------------------------------

import { describeMatch, teamIdOf } from './device.js';
import { SENTENCES, teamName } from './i18n.js';
import { lastMatch, liveMatch, nextMatch, resultOf, sides, teamMatches } from './matches.js';
import { formatDay, formatTime } from './time.js';

/** The sentences of a team: next match, last result, live score. */
export function teamSummary(service, teamId, language = service.config.language) {
  const now = service.now();
  const { timeZone } = service;
  const sentences = SENTENCES[language];
  const matches = teamMatches(service.data, teamId);
  const team = service.findTeam(teamId);
  const name = team ? teamName(team, language) : teamId;

  const next = nextMatch(matches, now);
  let nextSentence = sentences.noNext(name);
  let days = -1;
  if (next) {
    const words = describeMatch(next, teamId, language, timeZone, now);
    days = words.days;
    nextSentence = sentences.next({
      ...words,
      day: formatDay(next.start, language, timeZone, 'long'),
      time: next.timed ? formatTime(next.start, language, timeZone) : '',
    });
  }

  const score = (match) => {
    const { team: side, opponent } = sides(match, teamId);
    return {
      team: name,
      opponent: teamName(opponent, language),
      teamScore: side.score ?? 0,
      opponentScore: opponent.score ?? 0,
      competition: describeMatch(match, teamId, language, timeZone, now).competition,
    };
  };
  const last = lastMatch(matches);
  const lastSentence = last
    ? sentences.last({ ...score(last), result: resultOf(last, teamId) })
    : sentences.noLast(name);
  const live = liveMatch(matches);
  return {
    next: nextSentence,
    last: lastSentence,
    live: live ? sentences.live(score(live)) : '',
    days,
  };
}

export const SCENE_ACTIONS = {
  read_team: async (service, { fields = {} }) => {
    const teamId = teamIdOf(service.gladys, fields.device) ?? service.followedTeams()[0];
    if (!teamId) {
      throw new Error('No team followed: add one in the Discover tab of the Rugby integration');
    }
    const summary = teamSummary(service, teamId);
    return {
      sentence: [summary.live, summary.live ? '' : summary.next, summary.last]
        .filter(Boolean)
        .join(' '),
      next_match: summary.next,
      last_result: summary.last,
      live: Boolean(summary.live),
      days_until_match: summary.days,
    };
  },
};
