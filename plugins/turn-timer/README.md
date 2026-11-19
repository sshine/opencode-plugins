# Turn timer

A live timer for the turn [OpenCode](https://opencode.ai/) is working on, shown in
the prompt footer.

- While a turn runs, `⏱ 12s` counts up. Past a minute it reads `⏱ 2m 05s`, past
  an hour `⏱ 1h 02m`. Zero units are dropped, so a whole minute is `1m`, not
  `1m 00s`.
- When the turn ends, the timer stops and the footer keeps `⏱ 1m 42s` for that
  session.
- Every session has its own timer, so concurrent tabs do not share a clock.
- A failed turn paints the stopped timer with the error color, an interrupted one
  with the warning color, and a succeeded one with the faint color.
- State lives in plugin memory, so `/reload` in the middle of a turn keeps the
  clock instead of restarting it.

Timing starts when the server reports `session.execution.started`, so it excludes
the brief moment between pressing enter and the turn beginning, and includes time
the turn spends waiting on permissions or tools.

## How it is built

The plugin subscribes to the server event stream with `context.data.listen`, keeps
the turn state in `context.storage.memory`, and contributes one `<text>` to the
`prompt.footer.status` slot. Nothing is written to the session or to disk.
