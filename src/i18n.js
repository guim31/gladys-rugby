// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface: feature names (fixed when the device is added), states, scene
// sentences, the widget, the "Check" report and the connection status.
// German says "du", Spanish "usted". ESPN gives the team names in English:
// club names are kept, national teams are translated.
// -----------------------------------------------------------------------------

export const NAMES = {
  en: {
    device: (team) => `Rugby · ${team}`,
    next_match: 'Next match',
    next_kickoff: 'Kick-off',
    next_venue: 'Venue',
    last_result: 'Last result',
    days_until_match: 'Days until the match',
    match_live: 'Match in progress',
    match_today: 'Match today',
    team_score: 'Team score',
    opponent_score: 'Opponent score',
    rank: 'Rank',
  },
  fr: {
    device: (team) => `Rugby · ${team}`,
    next_match: 'Prochain match',
    next_kickoff: "Coup d'envoi",
    next_venue: 'Lieu',
    last_result: 'Dernier résultat',
    days_until_match: 'Jours avant le match',
    match_live: 'Match en cours',
    match_today: "Match aujourd'hui",
    team_score: "Score de l'équipe",
    opponent_score: 'Score adverse',
    rank: 'Classement',
  },
  de: {
    device: (team) => `Rugby · ${team}`,
    next_match: 'Nächstes Spiel',
    next_kickoff: 'Anstoß',
    next_venue: 'Spielort',
    last_result: 'Letztes Ergebnis',
    days_until_match: 'Tage bis zum Spiel',
    match_live: 'Spiel läuft',
    match_today: 'Spiel heute',
    team_score: 'Punkte des Teams',
    opponent_score: 'Punkte des Gegners',
    rank: 'Tabellenplatz',
  },
  es: {
    device: (team) => `Rugby · ${team}`,
    next_match: 'Próximo partido',
    next_kickoff: 'Saque inicial',
    next_venue: 'Estadio',
    last_result: 'Último resultado',
    days_until_match: 'Días hasta el partido',
    match_live: 'Partido en juego',
    match_today: 'Partido hoy',
    team_score: 'Puntos del equipo',
    opponent_score: 'Puntos del rival',
    rank: 'Clasificación',
  },
};

// National teams as ESPN names them, in the other languages.
const NATIONS = {
  fr: {
    England: 'Angleterre',
    Ireland: 'Irlande',
    Scotland: 'Écosse',
    Wales: 'Pays de Galles',
    Italy: 'Italie',
    Argentina: 'Argentine',
    Australia: 'Australie',
    'New Zealand': 'Nouvelle-Zélande',
    'South Africa': 'Afrique du Sud',
    Japan: 'Japon',
    Georgia: 'Géorgie',
    'United States': 'États-Unis',
    USA: 'États-Unis',
    Uruguay: 'Uruguay',
    Chile: 'Chili',
    Spain: 'Espagne',
    Romania: 'Roumanie',
    Germany: 'Allemagne',
    Belgium: 'Belgique',
    Netherlands: 'Pays-Bas',
  },
  de: {
    England: 'England',
    Ireland: 'Irland',
    Scotland: 'Schottland',
    Wales: 'Wales',
    France: 'Frankreich',
    Italy: 'Italien',
    Argentina: 'Argentinien',
    Australia: 'Australien',
    'New Zealand': 'Neuseeland',
    'South Africa': 'Südafrika',
    Japan: 'Japan',
    Fiji: 'Fidschi',
    Georgia: 'Georgien',
    'United States': 'USA',
    Chile: 'Chile',
    Spain: 'Spanien',
    Romania: 'Rumänien',
    Belgium: 'Belgien',
    Netherlands: 'Niederlande',
  },
  es: {
    England: 'Inglaterra',
    Ireland: 'Irlanda',
    Scotland: 'Escocia',
    Wales: 'Gales',
    France: 'Francia',
    Italy: 'Italia',
    Australia: 'Australia',
    'New Zealand': 'Nueva Zelanda',
    'South Africa': 'Sudáfrica',
    Japan: 'Japón',
    Fiji: 'Fiyi',
    Georgia: 'Georgia',
    'United States': 'Estados Unidos',
    USA: 'Estados Unidos',
    Spain: 'España',
    Romania: 'Rumanía',
    Germany: 'Alemania',
    Belgium: 'Bélgica',
    Netherlands: 'Países Bajos',
    Portugal: 'Portugal',
  },
};

/** A team name in a language: national teams translated, clubs as they are. */
export function teamName(team, language) {
  return NATIONS[language]?.[team.name] ?? team.name;
}

export const RESULT_WORDS = {
  en: { win: 'Win', draw: 'Draw', loss: 'Loss' },
  fr: { win: 'Victoire', draw: 'Nul', loss: 'Défaite' },
  de: { win: 'Sieg', draw: 'Unentschieden', loss: 'Niederlage' },
  es: { win: 'Victoria', draw: 'Empate', loss: 'Derrota' },
};

// Values of the text features.
export const STATE_TEXT = {
  en: {
    none: 'No match scheduled',
    home: 'home',
    away: 'away',
    tv: (channels) => `TV: ${channels}`,
    result: (word, score, opponent) => `${word} ${score} against ${opponent}`,
  },
  fr: {
    none: 'Aucun match prévu',
    home: 'domicile',
    away: 'extérieur',
    tv: (channels) => `TV : ${channels}`,
    result: (word, score, opponent) => `${word} ${score} contre ${opponent}`,
  },
  de: {
    none: 'Kein Spiel geplant',
    home: 'Heimspiel',
    away: 'Auswärtsspiel',
    tv: (channels) => `TV: ${channels}`,
    result: (word, score, opponent) => `${word} ${score} gegen ${opponent}`,
  },
  es: {
    none: 'Ningún partido previsto',
    home: 'local',
    away: 'visitante',
    tv: (channels) => `TV: ${channels}`,
    result: (word, score, opponent) => `${word} ${score} contra ${opponent}`,
  },
};

const whenEn = (days) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);
const whenFr = (days) =>
  days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`;
const whenDe = (days) => (days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`);
const whenEs = (days) => (days === 0 ? 'hoy' : days === 1 ? 'mañana' : `dentro de ${days} días`);

/**
 * Sentences ready to send or say (scene actions, trigger variables).
 * A match `m`: { team, opponent, home, competition, day, time, days, venue }.
 * A result `r`: { team, opponent, teamScore, opponentScore, result, competition }.
 */
export const SENTENCES = {
  en: {
    next: (m) =>
      `Next match of ${m.team}: ${m.home ? 'at home against' : 'away at'} ${m.opponent} ` +
      `(${m.competition}), ${m.day}${m.time ? ` at ${m.time}` : ''}, ${whenEn(m.days)}` +
      `${m.venue ? `, ${m.venue}` : ''}.`,
    noNext: (team) => `${team}: no match scheduled yet.`,
    live: (r) => `${r.team} ${r.teamScore}, ${r.opponent} ${r.opponentScore}: match in progress.`,
    last: (r) =>
      ({
        win: `${r.team} beat ${r.opponent} ${r.teamScore}-${r.opponentScore} (${r.competition}).`,
        draw: `${r.team} drew with ${r.opponent} ${r.teamScore}-${r.opponentScore} (${r.competition}).`,
        loss: `${r.team} lost to ${r.opponent} ${r.teamScore}-${r.opponentScore} (${r.competition}).`,
      })[r.result],
    noLast: (team) => `${team}: no recent result.`,
    kickoff: (m) => `Kick-off: ${m.team} against ${m.opponent} (${m.competition}).`,
    startingSoon: (m, minutes) =>
      `${m.team} against ${m.opponent} (${m.competition}) kicks off in ${minutes} minutes, at ${m.time}.`,
  },
  fr: {
    next: (m) =>
      `${m.team}, prochain match : ${m.home ? 'à domicile contre' : 'chez'} ${m.opponent} ` +
      `(${m.competition}), ${m.day}${m.time ? ` à ${m.time}` : ''}, ${whenFr(m.days)}` +
      `${m.venue ? `, ${m.venue}` : ''}.`,
    noNext: (team) => `${team} : aucun match prévu pour l'instant.`,
    live: (r) => `${r.team} ${r.teamScore}, ${r.opponent} ${r.opponentScore} : match en cours.`,
    last: (r) =>
      ({
        win: `${r.team} a battu ${r.opponent} ${r.teamScore} à ${r.opponentScore} (${r.competition}).`,
        draw: `${r.team} et ${r.opponent} ont fait match nul, ${r.teamScore} partout (${r.competition}).`,
        loss: `${r.team} a perdu contre ${r.opponent} ${r.teamScore} à ${r.opponentScore} (${r.competition}).`,
      })[r.result],
    noLast: (team) => `${team} : pas de résultat récent.`,
    kickoff: (m) => `Coup d'envoi : ${m.team} contre ${m.opponent} (${m.competition}).`,
    startingSoon: (m, minutes) =>
      `${m.team} contre ${m.opponent} (${m.competition}) commence dans ${minutes} minutes, à ${m.time}.`,
  },
  de: {
    next: (m) =>
      `Nächstes Spiel von ${m.team}: ${m.home ? 'zu Hause gegen' : 'auswärts bei'} ${m.opponent} ` +
      `(${m.competition}), ${m.day}${m.time ? ` um ${m.time}` : ''}, ${whenDe(m.days)}` +
      `${m.venue ? `, ${m.venue}` : ''}.`,
    noNext: (team) => `${team}: noch kein Spiel geplant.`,
    live: (r) => `${r.team} ${r.teamScore}, ${r.opponent} ${r.opponentScore}: Spiel läuft.`,
    last: (r) =>
      ({
        win: `${r.team} hat ${r.opponent} ${r.teamScore}:${r.opponentScore} geschlagen (${r.competition}).`,
        draw: `${r.team} und ${r.opponent} spielten ${r.teamScore}:${r.opponentScore} unentschieden (${r.competition}).`,
        loss: `${r.team} hat gegen ${r.opponent} ${r.teamScore}:${r.opponentScore} verloren (${r.competition}).`,
      })[r.result],
    noLast: (team) => `${team}: kein aktuelles Ergebnis.`,
    kickoff: (m) => `Anstoß: ${m.team} gegen ${m.opponent} (${m.competition}).`,
    startingSoon: (m, minutes) =>
      `${m.team} gegen ${m.opponent} (${m.competition}) beginnt in ${minutes} Minuten, um ${m.time}.`,
  },
  es: {
    next: (m) =>
      `Próximo partido de ${m.team}: ${m.home ? 'en casa contra' : 'en casa de'} ${m.opponent} ` +
      `(${m.competition}), ${m.day}${m.time ? ` a las ${m.time}` : ''}, ${whenEs(m.days)}` +
      `${m.venue ? `, ${m.venue}` : ''}.`,
    noNext: (team) => `${team}: todavía no hay ningún partido previsto.`,
    live: (r) => `${r.team} ${r.teamScore}, ${r.opponent} ${r.opponentScore}: partido en juego.`,
    last: (r) =>
      ({
        win: `${r.team} ganó a ${r.opponent} ${r.teamScore}-${r.opponentScore} (${r.competition}).`,
        draw: `${r.team} y ${r.opponent} empataron ${r.teamScore}-${r.opponentScore} (${r.competition}).`,
        loss: `${r.team} perdió contra ${r.opponent} ${r.teamScore}-${r.opponentScore} (${r.competition}).`,
      })[r.result],
    noLast: (team) => `${team}: no hay ningún resultado reciente.`,
    kickoff: (m) => `Saque inicial: ${m.team} contra ${m.opponent} (${m.competition}).`,
    startingSoon: (m, minutes) =>
      `${m.team} contra ${m.opponent} (${m.competition}) empieza dentro de ${minutes} minutos, a las ${m.time}.`,
  },
};

export const WIDGET_TEXT = {
  en: {
    live: 'Live',
    next: 'Next match',
    kickoff: 'Kick-off',
    rank: 'Rank',
    last: 'Last match',
    noTeam: 'Add a team in the Discover tab of the Rugby integration, then choose it here.',
    noData: 'ESPN has not been read yet.',
    none: 'None yet',
    daysHours: (days, hours) => `${days} d ${hours} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },
  fr: {
    live: 'En direct',
    next: 'Prochain match',
    kickoff: "Coup d'envoi",
    rank: 'Classement',
    last: 'Dernier match',
    noTeam:
      "Ajoutez une équipe dans l'onglet Découverte de l'intégration Rugby, puis choisissez-la ici.",
    noData: "ESPN n'a pas encore été lu.",
    none: 'Aucun prévu',
    daysHours: (days, hours) => `${days} j ${hours} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },
  de: {
    live: 'Live',
    next: 'Nächstes Spiel',
    kickoff: 'Anstoß',
    rank: 'Platz',
    last: 'Letztes Spiel',
    noTeam: 'Füge ein Team im Tab „Entdecken“ der Rugby-Integration hinzu und wähle es dann hier.',
    noData: 'ESPN wurde noch nicht gelesen.',
    none: 'Noch keins',
    daysHours: (days, hours) => `${days} T ${hours} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },
  es: {
    live: 'En directo',
    next: 'Próximo partido',
    kickoff: 'Saque inicial',
    rank: 'Clasificación',
    last: 'Último partido',
    noTeam: 'Añada un equipo en la pestaña Descubrir de la integración Rugby y luego elíjalo aquí.',
    noData: 'ESPN todavía no se ha leído.',
    none: 'Ninguno',
    daysHours: (days, hours) => `${days} d ${hours} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },
};

/** "1st", "1er", "1.", "1.º" */
export const ORDINAL = {
  en: (n) => {
    const tens = n % 100;
    const suffix =
      tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th');
    return `${n}${suffix}`;
  },
  fr: (n) => (n === 1 ? '1er' : `${n}e`),
  de: (n) => `${n}.`,
  es: (n) => `${n}.º`,
};

export const CHECK_TEXT = {
  en: {
    competition: (name, matches, teams) => `${name}: ${matches} matches read, ${teams} teams.`,
    noCompetition: 'No competition chosen: tick at least one in the configuration.',
    noTeam: 'No team followed yet: add your teams in the Discover tab.',
    rank: (rank, competition) => `${rank} in ${competition}.`,
    fresh: 'Data read just now.',
    stale: (error) => `ESPN could not be read (${error}): the data shown may be old.`,
  },
  fr: {
    competition: (name, matches, teams) => `${name} : ${matches} matchs lus, ${teams} équipes.`,
    noCompetition: 'Aucune compétition choisie : cochez-en au moins une dans la configuration.',
    noTeam: "Aucune équipe suivie : ajoutez vos équipes dans l'onglet Découverte.",
    rank: (rank, competition) => `${rank} en ${competition}.`,
    fresh: "Données lues à l'instant.",
    stale: (error) => `ESPN n'a pas pu être lu (${error}) : les données affichées peuvent dater.`,
  },
  de: {
    competition: (name, matches, teams) => `${name}: ${matches} Spiele gelesen, ${teams} Teams.`,
    noCompetition: 'Kein Wettbewerb gewählt: kreuze mindestens einen in der Konfiguration an.',
    noTeam: 'Noch kein Team verfolgt: füge deine Teams im Tab „Entdecken“ hinzu.',
    rank: (rank, competition) => `Platz ${rank} in ${competition}.`,
    fresh: 'Daten gerade gelesen.',
    stale: (error) =>
      `ESPN konnte nicht gelesen werden (${error}): die Daten können veraltet sein.`,
  },
  es: {
    competition: (name, matches, teams) => `${name}: ${matches} partidos leídos, ${teams} equipos.`,
    noCompetition: 'Ninguna competición elegida: marque al menos una en la configuración.',
    noTeam: 'Ningún equipo seguido: añada sus equipos en la pestaña Descubrir.',
    rank: (rank, competition) => `${rank} en ${competition}.`,
    fresh: 'Datos leídos ahora mismo.',
    stale: (error) => `No se pudo leer ESPN (${error}): los datos mostrados pueden ser antiguos.`,
  },
};

export const PROBLEM_TEXT = {
  unreachable: {
    en: 'ESPN cannot be read: matches and scores are not up to date.',
    fr: 'ESPN ne répond pas : les matchs et les scores ne sont pas à jour.',
    de: 'ESPN antwortet nicht: Spiele und Punktestände sind nicht aktuell.',
    es: 'ESPN no responde: los partidos y los marcadores no están actualizados.',
  },
  noCompetition: {
    en: 'No competition chosen in the configuration.',
    fr: 'Aucune compétition choisie dans la configuration.',
    de: 'Kein Wettbewerb in der Konfiguration gewählt.',
    es: 'Ninguna competición elegida en la configuración.',
  },
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: sieh dir ihre Protokolle an.',
  es: 'La integración no pudo arrancar: consulte sus registros.',
};
