# WebSocket protocol

Every client event takes a payload and an `ack` callback: `ack({ ok: true, data? } | { ok: false, error: { code, message? } })`. Schemas live in `apps/server/src/protocol.ts` (zod) and are the source of truth.

| Client → server | Payload                         | Who                                            |
| --------------- | ------------------------------- | ---------------------------------------------- |
| `room:create`   | `{ nick }`                      | anyone                                         |
| `room:join`     | `{ code, nick, sessionToken? }` | anyone                                         |
| `room:leave`    | `{}`                            | member                                         |
| `room:settings` | partial game settings           | host, lobby only                               |
| `room:kick`     | `{ playerId }`                  | host                                           |
| `game:start`    | `{}`                            | host, at least 2 connected players             |
| `game:declare`  | `{ declarationId }`             | player on turn                                 |
| `game:check`    | `{}`                            | player on turn, when a declaration exists      |
| `game:ready`    | `{}`                            | active player during the reveal                |
| `game:voteKick` | `{ playerId }`                  | active player, against the idle player on turn |
| `game:rematch`  | `{}`                            | host, after game over                          |

| Server → client | Payload                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session`       | `{ playerId, sessionToken, roomCode }`; store in localStorage for reconnect                                                                      |
| `room:state`    | members, host, phase, host overrides, effective settings, deck warning, ready ids, kick vote                                                     |
| `game:view`     | the receiving player's `PlayerView` (never other players' cards before the reveal)                                                               |
| `game:event`    | engine events (`DECLARED`, `CHECKED`, `REVEALED`, `PLAYER_ELIMINATED`, `GAME_OVER`, `ROUND_STARTED`) plus `AUTO_PLAYED` and `ELIMINATION_REASON` |
| `error`         | `{ code }` for things not tied to an ack (`KICKED`, `SERVER_SHUTDOWN`)                                                                           |

Error codes: see `ERROR_CODES` in `protocol.ts` and [ADR 0004](adr/0004-vote-kick-and-server-events.md). Limits: 10 events per second per connection, 13 members per room, nick 1–16 characters and unique per room. `GET /healthz` returns `{ ok: true }`.
