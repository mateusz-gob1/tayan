# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed

- The reveal fits on one screen without scrolling: the declared hand and everyone's cards side by side, card size chosen to fit, and a fixed bottom bar with who gets a card and the Next button
- The last check of a game now shows the normal reveal first (Next for everyone who played the round, or 10 s), and only then the end screen with the winner
- Removed the minimum-raise button: choosing the raise is up to the player

### Added

- The game works on phones and tablets: a sideways phone layout (table on the left, hand and actions on the right), an upright phone layout, the smallest 1x card size, a full-screen help, touch-friendly buttons, the screen stays awake during a game, and end-to-end tests for both phone orientations
- 8-bit sound effects synthesised in the browser (no audio files): deal, card flip, declaration, check, extra card, elimination, win/lose, button ticks, your turn; all in one table in `apps/web/src/lib/sound.ts`
- Stepped pixel animations: cards fly in when dealt, cards turn over one by one at the reveal, the active player's frame blinks, an eliminated player rattles, a pixel trophy bounces on the end screen; all disabled with `prefers-reduced-motion`

### Changed

- The interface scales to the window: text and borders smoothly (root font 16 to 28 px), card sprites in whole-number steps (2x, and 3x/4x only on very big windows) so pixels stay crisp; the table fills the free space. The tuning numbers are in `pickLayout` (apps/web/src/lib/scale.ts)
- Table screen: your cards and the action buttons sit together in one area below the table; bid history moved to a narrow side panel
- UI font changed to Jersey 25 (Pixelify Sans made the digit 5 look like an S)

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
