# Tayan

Tayan is a browser-based real-time multiplayer card game based on the rules of Bluff: players bid poker hands they believe exist in the pooled cards of all players. Rooms are joined by code/link, no accounts. The source of truth for all rules and requirements is [docs/spec.md](docs/spec.md) (Polish). Ask, or write an ADR in `docs/adr/`, instead of silently guessing when the spec is unclear.

## Layout

- `packages/engine` – pure game logic (no I/O, no runtime dependencies), shared by server and client
- `apps/server` – Node.js + Socket.IO, in-memory rooms (M2)
- `apps/web` – React + Vite + Tailwind client (M3)

## Commands

- `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm e2e`, `pnpm build`
- `pnpm engine:deck-table` – regenerate the deck-selection table; `pnpm engine:cli` – play locally in the terminal

## Inviolable rules

- Engine has no I/O and no runtime dependencies; RNG is always passed in.
- A client never receives other players' cards before the reveal; `toPlayerView` is the only place deciding visibility.
- Every client payload is parsed with zod on the server.
- No UI text outside the i18n files (`apps/web/src/i18n/{pl,en}.json`); the server sends codes, not human text.

## Conventions

- Code, comments and commits in English; Conventional Commits; TypeScript `strict`.
- One milestone = one branch = one PR, split into small commits. Start each milestone with a plan.

## Definition of Done

Tests, lint and typecheck are green, and documentation is updated if behaviour changed.
