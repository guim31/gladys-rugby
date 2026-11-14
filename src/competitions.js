// -----------------------------------------------------------------------------
// The competitions ESPN serves, checked one by one on its public API in
// November 2026 (scoreboard, teams and standings answered with the current
// season). Pro D2 is not served: it is not offered rather than guessed.
//
// The keys are stored in the configuration of the users: they are forever.
// The order is the order of the form, and the one used for the rank of a team
// (its domestic league before its European cup).
// -----------------------------------------------------------------------------

export const COMPETITIONS = [
  {
    key: 'top14',
    espn: '270559',
    name: { en: 'Top 14', fr: 'Top 14', de: 'Top 14', es: 'Top 14' },
  },
  {
    key: 'premiership',
    espn: '267979',
    name: { en: 'Premiership', fr: 'Premiership', de: 'Premiership', es: 'Premiership' },
  },
  {
    key: 'urc',
    espn: '270557',
    name: {
      en: 'United Rugby Championship',
      fr: 'United Rugby Championship',
      de: 'United Rugby Championship',
      es: 'United Rugby Championship',
    },
  },
  {
    key: 'super_rugby',
    espn: '242041',
    name: {
      en: 'Super Rugby Pacific',
      fr: 'Super Rugby Pacific',
      de: 'Super Rugby Pacific',
      es: 'Super Rugby Pacific',
    },
  },
  {
    key: 'champions_cup',
    espn: '271937',
    name: {
      en: 'Champions Cup',
      fr: 'Champions Cup',
      de: 'Champions Cup',
      es: 'Champions Cup',
    },
  },
  {
    key: 'challenge_cup',
    espn: '272073',
    name: {
      en: 'Challenge Cup',
      fr: 'Challenge Cup',
      de: 'Challenge Cup',
      es: 'Challenge Cup',
    },
  },
  {
    key: 'six_nations',
    espn: '180659',
    name: {
      en: 'Six Nations',
      fr: 'Tournoi des Six Nations',
      de: 'Six Nations',
      es: 'Seis Naciones',
    },
  },
  {
    key: 'rugby_championship',
    espn: '244293',
    name: {
      en: 'Rugby Championship',
      fr: 'Rugby Championship',
      de: 'Rugby Championship',
      es: 'Rugby Championship',
    },
  },
  {
    key: 'nations_championship',
    espn: '17567',
    name: {
      en: 'Nations Championship',
      fr: 'Nations Championship',
      de: 'Nations Championship',
      es: 'Nations Championship',
    },
  },
  {
    key: 'test_matches',
    espn: '289234',
    name: {
      en: 'Test match',
      fr: 'Test-match',
      de: 'Testspiel',
      es: 'Test match',
    },
  },
  {
    key: 'world_cup',
    espn: '164205',
    name: {
      en: 'Rugby World Cup',
      fr: 'Coupe du monde',
      de: 'Weltmeisterschaft',
      es: 'Copa del Mundo',
    },
  },
];

export const COMPETITION_KEYS = COMPETITIONS.map((competition) => competition.key);

const BY_KEY = new Map(COMPETITIONS.map((competition) => [competition.key, competition]));

export function competition(key) {
  return BY_KEY.get(key);
}

/** The name of a competition in a language ("Top 14"). */
export function competitionName(key, language) {
  return BY_KEY.get(key)?.name[language] ?? key;
}
