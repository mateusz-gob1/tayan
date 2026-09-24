# 0003: Engine throws typed errors; randomness and time come from the caller

Status: accepted

`applyAction(state, action, ctx)` throws `EngineError` with a code (`NOT_YOUR_TURN`, `BID_TOO_LOW`, ...) on illegal actions; the server maps these to `ack({ ok: false, error })`. `ctx` carries the `Rng` and an optional timestamp, so the engine stays deterministic in tests. State is copied shallowly per action (declarations are shared, not cloned).
