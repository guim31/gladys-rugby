// -----------------------------------------------------------------------------
// A team's view of the matches read from ESPN: its live match, its next one,
// its last result and its rank. Pure functions of the data and the clock.
// -----------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;

// A match still "to come" this long after its kick-off time is waiting for
// ESPN to say it started (it is then watched live).
export const LIVE_WINDOW = 4 * HOUR;

const CALLED_OFF = /POSTPONED|CANCEL|ABANDON|FORFEIT|DELAYED|SUSPENDED/;

/** Every match of a team in the data, oldest first, each once. */
export function teamMatches(data, teamId) {
  const byId = new Map();
  for (const entry of Object.values(data.calendar ?? {})) {
    for (const match of entry.matches ?? []) {
      if (match.home.id === teamId || match.away.id === teamId) {
        byId.set(match.id, match);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** The team's side and the other one. */
export function sides(match, teamId) {
  const home = match.home.id === teamId;
  return { team: home ? match.home : match.away, opponent: home ? match.away : match.home, home };
}

/** 'win', 'draw' or 'loss' of a finished match, null when the score is not known. */
export function resultOf(match, teamId) {
  const { team, opponent } = sides(match, teamId);
  if (team.score === null || opponent.score === null) {
    return null;
  }
  if (team.score === opponent.score) {
    return 'draw';
  }
  return team.score > opponent.score ? 'win' : 'loss';
}

export function isFinished(match) {
  return match.state === 'post' && match.completed;
}

export function isCalledOff(match) {
  return CALLED_OFF.test(match.status) || (match.state === 'post' && !match.completed);
}

/**
 * The match being played. One still "being played" in the cache long after
 * its kick-off (ESPN or the network failed around full time) is not shown as
 * live until the next reading says how it ended.
 */
export function liveMatch(matches, now) {
  return matches.find((match) => match.state === 'in' && now <= match.start + LIVE_WINDOW) ?? null;
}

/** The next match to be played (not the live one, not one called off). */
export function nextMatch(matches, now) {
  return (
    matches.find(
      (match) => match.state === 'pre' && !isCalledOff(match) && match.start > now - LIVE_WINDOW,
    ) ?? null
  );
}

/** The last finished match with a score. */
export function lastMatch(matches) {
  return matches.findLast((match) => isFinished(match) && resultOf(match, match.home.id)) ?? null;
}

/** The next matches, at most `count`. */
export function upcomingMatches(matches, now, count) {
  return matches
    .filter(
      (match) => match.state === 'pre' && !isCalledOff(match) && match.start > now - LIVE_WINDOW,
    )
    .slice(0, count);
}

/**
 * The rank of a team: in the first competition of the configuration whose
 * standings hold it (its domestic league before its European cup).
 * @returns {{ competition: string, rank: number, points: number|null, group: string }|null}
 */
export function teamRank(data, competitions, teamId) {
  for (const key of competitions) {
    const row = data.standings?.[key]?.rows?.find((entry) => entry.teamId === teamId);
    if (row) {
      return { competition: key, rank: row.rank, points: row.points, group: row.group };
    }
  }
  return null;
}

/** Is a match to be read live now (about to start, or being played)? */
export function isLiveWindow(match, now) {
  if (match.state === 'in') {
    return now <= match.start + LIVE_WINDOW;
  }
  return (
    match.state === 'pre' &&
    match.timed &&
    !isCalledOff(match) &&
    now >= match.start - 5 * 60 * 1000 &&
    now <= match.start + LIVE_WINDOW
  );
}
