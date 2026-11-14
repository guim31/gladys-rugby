# Rugby

Follow your rugby teams in Gladys: the next match in your local time, the live score, the last result
and the rank, for your dashboards and your scenes.

## What you get

- One device per team you follow (Stade Toulousain, France, Leinster…), with its next match, kick-off,
  venue, last result, live score and rank.
- Scene triggers: **Match starting soon**, **Kick-off**, **Match finished** (with the result: win, draw or
  loss).
- A scene action that writes sentences ready to send or say aloud.
- A **Rugby team** dashboard widget.

## Competitions

Top 14, Premiership, United Rugby Championship, Super Rugby Pacific, Champions Cup, Challenge Cup, Six
Nations, Rugby Championship, Nations Championship (autumn tests), other test matches and the Rugby World
Cup. Pro D2 is not offered: ESPN does not serve it.

## Setting up

1. In the **Configuration** tab, tick the competitions you care about and choose the language of the texts
   (French by default), then save.
2. Open the **Discover** tab: every team of these competitions is listed. Add the ones you follow; each one
   becomes a device.
3. Press **Check** to read ESPN again and see what the integration knows of your teams.

A team plays in several competitions (Stade Toulousain: Top 14 and Champions Cup): its device gathers the
matches of every ticked competition. Its rank comes from the first competition of the list that ranks it,
its domestic league before its European cup.

## Devices

| Feature              | Value                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Next match           | "Lyon – Stade Toulousain (Top 14)", home team first                |
| Kick-off             | Day and time in the time zone of Gladys (the day alone if not set) |
| Venue                | Stadium and city, and the TV channel when ESPN gives one           |
| Last result          | "Win 28-18 against Clermont Auvergne (Top 14)"                     |
| Days until the match | 0 on match day, -1 when no match is scheduled                      |
| Match in progress    | 1 while a match is being played                                    |
| Match today          | 1 on match day                                                     |
| Team score           | During a match the live score, then the score of the last match    |
| Opponent score       | Same, for the opponent                                             |
| Rank                 | Rank in the league, or in the pool of a cup                        |

Feature names are set when a team is added: change the language before adding your teams.

## Scenes

### Triggers

- **Match starting soon**: 15, 30, 60 or 120 minutes before the scheduled kick-off of a followed team (only
  when the time is known).
- **Kick-off**: when ESPN reports that the match has started, within about a minute.
- **Match finished**: when the match is over. Its **Result** filter keeps only wins, draws or losses: pick
  **Win** to celebrate.

Leave **Team** empty to fire for every followed team. The scene can read the team, the opponent, the
competition, home or away, the kick-off time, the venue, the scores, the result and a ready-made
**sentence**.

### Action

**Read a team's news** returns a summary, the next match, the last result as sentences, whether a match is
in progress and the days until the next match. Send them in a message or have them said aloud.

## Dashboard

The **Rugby team** widget shows one followed team: the live score during a match, the countdown to the next
one, the rank, the next three matches and the last result. Its settings choose the team and can hide the
next matches or the last result.

## Data and limits

- The data come from ESPN's public JSON API (`site.api.espn.com`): no account, no key. **This API is neither
  official nor documented**: it may change or stop without notice. The integration reads it sparingly: the
  teams once a day, the matches of each competition every 6 hours (five requests: last month to three
  months ahead), the standings every 6 hours and after a match, and the scoreboard of the day **every
  minute only during a match of a followed team**, from 5 minutes before the kick-off.
- Matches more than three months ahead are not read: in November, the next Six Nations do not show yet.
- ESPN gives team names in English, without accents (Stade Francais Paris); national teams are translated.
- The TV channel is rarely given for European rugby.
- A Gladys calendar is not filled: an integration is either a device or a calendar integration.
- Not affiliated with ESPN, the leagues or the clubs.

## Troubleshooting

- **No team in the Discover tab**: tick at least one competition and save, then press **Check**. If ESPN
  cannot be read, the integration status says so.
- **A value stays empty**: the integration never guesses; a rank appears once ESPN publishes standings for
  the season.
- Logs: the integration logs its start-up and its errors; set `LOG_LEVEL=debug` for every reading.
