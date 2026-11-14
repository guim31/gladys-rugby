# Rugby for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that follows your rugby
teams: the next match in the local time of Gladys, the live score, the last result and the rank, for
dashboards and scenes. Data from ESPN's public JSON API: no account, no key.

Feedback welcome on the [Gladys forum](https://community.gladysassistant.com).

## Features

- **One device per team you follow**, chosen in the Discover tab among the teams of the competitions you
  tick: next match, kick-off, venue (and TV channel when given), last result, days until the match,
  match in progress, match today, team and opponent scores (live during a match), rank.
- **Scene triggers**: "Match starting soon" (15 minutes to 2 hours before the kick-off), "Kick-off" and
  "Match finished" with a result filter (win, draw, loss), each with a ready-made sentence.
- **Scene action** "Read a team's news": sentences ready to send or say aloud.
- **Dashboard widget "Rugby team"**: live score, countdown, rank, next three matches, last result.
- Competitions: Top 14, Premiership, United Rugby Championship, Super Rugby Pacific, Champions Cup,
  Challenge Cup, Six Nations, Rugby Championship, Nations Championship, other test matches, Rugby World
  Cup. Pro D2 is not served by ESPN.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1.0 or later.
- Internet access from Gladys (`site.api.espn.com`, HTTPS).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-rugby`.
2. In the **Configuration** tab, tick your competitions and choose the language of the texts. Save.
3. In the **Discover** tab, add the teams you follow; add the **Rugby team** widget to a dashboard.

The full user documentation is in [English](docs/en.md), [French](docs/fr.md), [German](docs/de.md)
and [Spanish](docs/es.md).

## How it works

- ESPN's API is **unofficial and undocumented**; it is read sparingly, one request at a time: the teams
  of each competition once a day, its matches every 6 hours (`scoreboard?dates=YYYYMM`, last month to
  three months ahead), the standings every 6 hours and after a match of a followed team, and the
  scoreboard of the day every minute **only** from 5 minutes before the kick-off of a followed team until
  ESPN says the match is over (4 hours at most). A failure is retried after 10 minutes (2 during a
  match).
- The answers are kept in `/data/cache.json`: devices and widget keep working when ESPN is down, and the
  connection status says so.
- The devices are published with `should_poll: false`: a clock in the container ticks every minute,
  publishes the states that changed (all of them twice a day) and fires the scene triggers. "Kick-off"
  and "Match finished" come from the state ESPN reports, compared with the previous one (stored in
  `/data/triggers.json`): a fresh install or a long outage never announces old matches.
- Times are shown in the time zone Gladys gives the container (`TZ`).

## Limitations

- ESPN may change or close its API without notice.
- Matches more than three months ahead are not read.
- Team names come in English, without accents (national teams are translated).
- TV channels are rarely given for European rugby.
- No Gladys calendar is filled: an integration is either a device or a calendar integration.

## Development

Node.js 22+, ESM, no build step. One runtime dependency:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys; no network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            every SDK handler -> the service, the "Check" action
src/service.js        the clock: readings, cache, live reading, states, scene triggers, status
src/espn.js           ESPN client and parsers
src/competitions.js   the competitions offered and their ESPN ids
src/matches.js        a team's live, next and last match, its rank
src/device.js         the team device and its states
src/widgets.js        "Rugby team" dashboard widget
src/scenes.js         "Read a team's news"
src/i18n.js           every text of the code, in four languages
src/time.js           instants in the time zone of Gladys
src/config.js         DEFAULT_CONFIG (mirrors the manifest) + normalization
src/store.js          JSON files in /data
test/fixtures/        Gladys feature table, answers recorded from ESPN on 2026-11-14
```

To run it outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="rugby" \
RUGBY_DATA_DIR=./data \
TZ=Europe/Paris \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit the versions by hand. See
[`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- ESPN for the public data; the tests replay answers recorded from its API in November 2026.
- The idea comes from the Gladys forum list of the most used Home Assistant integrations; Home
  Assistant's "Team Tracker" custom integration reads the same API. No code was taken from it.
- Started from the official
  [integration-template-js](https://github.com/GladysAssistant/integration-template-js).

## Disclaimer

This integration is not affiliated with, endorsed by or connected to ESPN, the leagues or the clubs. All
names and marks belong to their owners.

## License

[Apache-2.0](LICENSE)
