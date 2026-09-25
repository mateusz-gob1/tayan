# 0006: Spectators and eliminated players may see the players' cards

## Status

Accepted.

## Context

The rule "a client never receives other players' cards before the reveal" protects the game from cheating by the people who are playing it. It says nothing about people who are not playing: a player who has been eliminated, or someone who joined a running game and waits for the rematch. Watching a game without seeing the cards is dull, and the owner wanted them to be able to follow the play.

## Decision

A room setting `spectatorsSeeCards` (default `true`, chosen by the host in the lobby) lets `toPlayerView` add `spectatedHands` (every hand of the current round) to the view of someone who is **not playing**: an eliminated player, or an id that is not seated. A player who is still in the game never receives it, whatever the setting says. `toPlayerView` stays the only place that decides visibility, and the setting travels in `GameSettings` like the others.

## Consequences

- An eliminated player could tell a friend who is still playing what he sees (spoken or typed outside the game). The server cannot prevent this, so a host who does not trust the table turns the setting off.
- The engine tests cover: a player in the game never gets the field, a late joiner and an eliminated player get it while the setting is on, nobody gets it while it is off.
- The client draws the real cards on the seats of the players for someone who is watching, instead of card backs.
