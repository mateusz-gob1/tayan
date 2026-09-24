# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- Testing aid: the host can add bots in the lobby ("Add a bot", "Play with bots"); bots are driven by the server and can be switched off with `ENABLE_BOTS=false` (server) and `VITE_ENABLE_BOTS=false` (client)
- The random bot now usually raises by small steps instead of jumping to the top hands

### Changed

- Updated all dependencies (zod 4, vitest 5, vite 8, eslint 10, pino 10, i18next 26, TypeScript 6) and GitHub Actions; Dependabot now groups major and action updates into one pull request each

### Removed

- The tagline under the logo and the first-visit tutorial (help stays available under "?" and the H key)

### Added

- Dockerfile and Render blueprint for the game server, Cloudflare Pages setup for the client
- Playwright end-to-end tests, Docker image check in CI, keep-alive ping workflow
- Documentation site (VitePress, PL/EN), deployment guide, issue and pull request templates
- Pre-commit hook (Prettier and ESLint on staged files)
- `CLIENT_ORIGIN` accepts several comma-separated origins

## [0.1.0]

### Added

- Game engine: deck selection, declaration ordering, pool matching, rounds, eliminations, player views
- Server: rooms, lobby, reconnect, turn and inactivity timers, vote kick, spectators, rematch
- Web client: start, lobby, table, reveal and game over screens, help panel, tutorial, PL/EN
- Default elimination limit of 6 cards (5 above 10 players)
