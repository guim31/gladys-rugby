// -----------------------------------------------------------------------------
// Dashboard widget "Rugby team" (key "rugby_team"): one followed team, its
// live score, the countdown to its next match, its rank, its next matches and
// its last result. Produced from the matches, localized from the language of
// the person looking at it; the title is the name given to the device in
// Gladys.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { matchTitle, teamIdOf } from './device.js';
import { ORDINAL, RESULT_WORDS, WIDGET_TEXT, teamName } from './i18n.js';
import {
  lastMatch,
  liveMatch,
  nextMatch,
  resultOf,
  sides,
  teamMatches,
  teamRank,
  upcomingMatches,
} from './matches.js';
import { WIDGET_KEY } from './service.js';
import { formatStart } from './time.js';

export const UPCOMING = 3;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const RESULT_COLORS = {
  win: WIDGET_COLORS.SUCCESS,
  draw: WIDGET_COLORS.WARNING,
  loss: WIDGET_COLORS.DANGER,
};

function countdown(match, now, text) {
  const left = Math.max(0, match.start - now);
  if (left >= DAY) {
    return text.daysHours(Math.floor(left / DAY), Math.floor((left % DAY) / HOUR));
  }
  return text.hoursMinutes(Math.floor(left / HOUR), Math.floor((left % HOUR) / MINUTE));
}

/**
 * The widget content.
 * @param {object} service the RugbyService
 * @param {{ settings?: object, language?: string }} request
 */
export function buildContent(service, { settings = {}, language } = {}) {
  const lang = LANGUAGES.includes(language) ? language : service.config.language;
  const text = WIDGET_TEXT[lang];
  const now = service.now();
  const { data, timeZone } = service;
  const components = [];

  const followed = service.followedTeams();
  const chosen = teamIdOf(service.gladys, settings.device);
  const teamId = chosen && followed.includes(chosen) ? chosen : followed[0];
  if (!teamId) {
    components.push({ type: 'text', variant: 'body', text: text.noTeam });
    return { ttl_seconds: 300, components };
  }
  const team = service.findTeam(teamId);
  const title = service.gladysName(teamId) ?? (team ? teamName(team, lang) : teamId);
  components.push({ type: 'text', variant: 'heading', text: title.slice(0, 40) });
  if (Object.keys(data.calendar).length === 0) {
    components.push({ type: 'text', variant: 'body', text: text.noData });
    return { ttl_seconds: 300, components };
  }

  const matches = teamMatches(data, teamId);
  const live = liveMatch(matches);
  if (live) {
    const { team: side, opponent } = sides(live, teamId);
    components.push({
      type: 'value',
      label: `${text.live} · ${teamName(opponent, lang)}`.slice(0, 24),
      value: `${side.score ?? 0} – ${opponent.score ?? 0}`,
      icon: 'activity',
      color: WIDGET_COLORS.SUCCESS,
    });
  }
  const next = nextMatch(matches, now);
  components.push({
    type: 'value',
    label: text.next,
    value: next ? countdown(next, now, text) : text.none,
    icon: 'clock',
    color: WIDGET_COLORS.NEUTRAL,
  });
  const rank = teamRank(data, service.config.competitions, teamId);
  if (rank) {
    components.push({
      type: 'value',
      label: text.rank,
      value: ORDINAL[lang](rank.rank),
      icon: 'award',
      color: rank.rank === 1 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    });
  }

  if (settings.show_upcoming !== false) {
    const upcoming = upcomingMatches(matches, now, UPCOMING);
    if (upcoming.length > 0) {
      components.push({
        type: 'card-list',
        display: 'list',
        items: upcoming.map((match) => ({
          title: matchTitle(match, lang).slice(0, 60),
          subtitle: [formatStart(match, lang, timeZone), match.tv].filter(Boolean).join(' · '),
        })),
      });
    }
  }

  const last = lastMatch(matches);
  if (last && settings.show_last !== false) {
    const result = resultOf(last, teamId);
    const { team: side, opponent } = sides(last, teamId);
    components.push({
      type: 'status',
      items: [
        {
          label: text.last,
          value: `${RESULT_WORDS[lang][result]} ${side.score}-${opponent.score} · ${teamName(
            opponent,
            lang,
          )}`.slice(0, 40),
          color: RESULT_COLORS[result],
        },
      ],
    });
  }
  // The clock asks for a refresh when a score or the countdown changes.
  return { ttl_seconds: live ? 120 : 900, components };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (service, request) => buildContent(service, request),
  },
};
