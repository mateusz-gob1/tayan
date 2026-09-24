# 0005: Default elimination limit is 6

Status: accepted (requested by the project owner after playing the first build)

A player is eliminated on reaching 6 cards; holding 5 is still fine. The original spec used 5.

Consequences:

- Hands can be up to 5 cards, so more cards are in play and strong hands appear more often. The deck-selection table was regenerated for the new default (`pnpm engine:deck-table`): the full 52-card deck is needed from 6 players, and from 8 players even the full deck exceeds the difficulty thresholds (15% for four of a kind, 10% for a straight flush), so the lobby shows its warning and suggests lowering the limit. The thresholds are constants in `DECK_THRESHOLDS` and can be tuned.
- With 11 or more players five-card hands do not fit in 52 cards, so the default is 5 there (`defaultEliminationLimit`). The lobby disables limits that do not fit.
- The host can still choose 3 to 6. The original spec table (computed for limit 5) is kept as a regression oracle in the engine tests.
- Games last longer: every player can lose four rounds before being eliminated with 2 starting cards.
