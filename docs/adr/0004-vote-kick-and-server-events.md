# 0004: Vote-kick event and extra protocol codes

Status: accepted

The spec describes voting to remove an idle player but lists no client event for it. Added `game:voteKick { playerId }`: allowed only against the player whose turn it is, once `kickVoteAfterSec` has passed since their turn started; when more than half of the other active players have voted, the player is eliminated as if they had lost and becomes a spectator. Votes reset whenever the turn changes.

Also added error codes beyond the spec: `NOT_IN_ROOM`, `NOT_ALLOWED`, `INVALID_PHASE`, `INVALID_SETTINGS`, `NOT_ENOUGH_PLAYERS`, `RATE_LIMITED`, `KICKED`, `SERVER_SHUTDOWN`, `INTERNAL`. `GAME_IN_PROGRESS` is reserved: joining a running game succeeds as a spectator, as the spec requires. The client-side 25 s heartbeat is provided by Socket.IO's own ping (`pingInterval` 25 s), so no custom event exists.
