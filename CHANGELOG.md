# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-11-15

### Fixed

- The Discover tab offers the teams of the current season: ESPN's team list can lag a season behind
  (Top 14 in November 2026: RC Vannes missing, Oyonnax listed). The teams playing this season's
  matches now complete or replace it, in every competition. Teams already added keep working.

## [1.0.0] - 2026-11-14

### Added

- One device per rugby team followed, chosen in the Discover tab among the teams of the ticked
  competitions: next match, kick-off in the local time of Gladys, venue, last result, days until the
  match, match in progress, match today, team and opponent scores (live during a match), rank.
- Competitions: Top 14, Premiership, United Rugby Championship, Super Rugby Pacific, Champions Cup,
  Challenge Cup, Six Nations, Rugby Championship, Nations Championship, other test matches, Rugby
  World Cup.
- Scene triggers "Match starting soon", "Kick-off" and "Match finished" (with a result filter), and the
  scene action "Read a team's news".
- Dashboard widget "Rugby team": live score, countdown, rank, next matches, last result.
- "Check" action: reads ESPN again and reports the competitions and the teams followed.
- Texts in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-rugby/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-rugby/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-rugby/releases/tag/v1.0.0
