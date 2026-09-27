# 0007: Default hand ranking computed from exact probabilities

Status: accepted (requested by the project owner, based on research from a separate project, `tayan-lab`)

## Context

The fixed `DEFAULT_CATEGORY_ORDER` (high card, pair, two pair, straight, three of a kind, flush,
full house, four of a kind, straight flush) was a guess, never checked against the actual odds.
`tayan-lab`, a separate research repository, computed the exact probability of each category
existing in the pool for every player count, weighted over a whole game's rounds, and found the
guessed order is wrong for almost every player count (its findings and formulas are written up in
`tayan_lab`'s `docs/ranking-algorithm.md`, referenced here as "the research"). It also proposed a
smaller deck for most player counts (chosen by a different criterion than the engine's own table)
and, separately, changing the deck once a game reaches its final two players, and reconsidered a
few defaults.

Independently verified before implementing: the research's worked examples (a `p(PAIR) = 3/95`
control value, and a larger reference table for 24-card, 6-card-pool odds) were recomputed by hand
from the research's own formulas and matched exactly, so the formulas themselves are trusted, not
just copied.

## Decision

- The engine computes the game's `categoryOrder` once, at `createGame` (`rankCategoriesStatic`,
  `packages/engine/src/ranking.ts`), from the exact weighted probability of each category
  (`packages/engine/src/probability.ts`, `poolDistribution.ts`) for that game's deck, player
  count, starting cards and elimination limit. It is **never recomputed during a game**. Ties
  within 2 percentage points keep `DEFAULT_CATEGORY_ORDER`'s relative order, so the result is
  deterministic and does not depend on floating point (every comparison is an exact fraction,
  compared by cross-multiplication, per the research's own guidance).
- The standard-settings deck table (`DECK_TABLE` in `deckSelection.ts`) is replaced with the
  research's table, and the default starting-cards threshold changes from "2 up to 6 players" to
  "2 up to 7 players" (both from the research).
- **Explicitly not adopted, against the research's own recommendation:** recomputing the deck and
  ranking once a game reaches its final two players (the research's "final-phase override"). The
  owner wants the deck and the declaration list to never change once a game has started, full
  stop — no exceptions, even a single one-time exception at the very end. This is a deliberate
  departure from the research, not an oversight: the research itself found this worthwhile, and a
  future owner decision could revisit it.
- **Also not adopted** (the research rejected these itself): a per-round dynamic ranking, and a
  "staged" ranking that switches partway through a game.

## Consequences

- `resolveSettings` (called from the lobby to preview a room's settings before anyone has started
  a game, `apps/server/src/room.ts`) now does real, if small, computation instead of returning a
  constant. `rankCategoriesStatic` is memoized by `(lowestRank, players, startingCards,
eliminationLimit)`, so this cost is paid at most once per distinct combination for the life of
  the server process, not on every lobby update. Measured: about 280 ms for the worst case (13
  players), effectively free afterwards. That first-time cost is a real, if one-off and localised,
  regression in lobby responsiveness worth knowing about if it is ever felt on the free hosting
  tier.
- The old deck-selection warning (`DECK_TABLE`'s `warning` flag, shown in the lobby as "even the
  full deck often contains fours and straight flushes") does **not** carry over to the new table:
  checking it against the research's own deck choices showed it would fire for nearly every player
  count above 3, because the research optimises for a different thing (whether a specific
  declaration can be found at all) and deliberately accepts decks the old threshold would flag.
  Showing that warning under the new table would contradict the lobby's own new copy that the
  defaults are recommended. The warning still fires, unchanged, when a host picks non-standard
  starting cards or elimination limit (the simulation-based fallback below).
- **Known gap, accepted:** the research's new deck table only covers the _default_ starting
  cards/elimination limit for each player count. When a host changes those in the lobby, the
  engine still picks the deck with the old method (`chooseDeck`'s Monte Carlo simulation,
  `DECK_THRESHOLDS`) — `tayan-lab` did not provide a replacement for that path. The ranking itself
  (`rankCategoriesStatic`) has no such gap: it is computed on the fly for any combination.
- Existing tests that depended on the exact old order or deck for standard settings were updated
  to the new values (`packages/engine/test/{game,deckSelection}.test.ts`,
  `apps/server/test/rooms.test.ts`); one test asserting the shipped deck table tracks a fresh
  simulation was removed outright, since the two are now intentionally unrelated.
- A compact ranking list is now shown on the table screen at all times (`HandRanking.tsx`), not
  only in the help panel, since the order is no longer something a player can memorise once and
  reuse across games.
