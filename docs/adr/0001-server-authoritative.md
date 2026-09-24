# 0001: Server-authoritative game, pure engine

Status: accepted

The engine (`packages/engine`) is a set of pure functions with no I/O and no runtime dependencies. The server calls `applyAction` and sends each player their own `PlayerView` (`toPlayerView`); clients only send intents. This keeps other players' cards off the wire until the reveal and lets the same code validate moves on the server and hint legal declarations in the UI.
