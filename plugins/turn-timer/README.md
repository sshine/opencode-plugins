# Turn timer

A live timer for the turn [OpenCode](https://opencode.ai/) is working on, shown in
the prompt footer.

- While a turn runs, `⏱ 12s` counts up. Past a minute it reads `⏱ 2m 05s`, past
  an hour `⏱ 1h 02m`. Zero units are dropped, so a whole minute is `1m`, not
  `1m 00s`.
- When the turn ends, the timer stops, the footer keeps `⏱ 1m 42s` for that
  session, and a toast reports how long it took.
- Every session has its own timer, so concurrent tabs do not share a clock.
- `session.execution.succeeded` produces a success toast, `failed` an error
  toast, and `interrupted` an info toast.
- State lives in plugin memory, so `/reload` in the middle of a turn keeps the
  clock instead of restarting it.

Timing starts when the server reports `session.execution.started`, so it excludes
the brief moment between pressing enter and the turn beginning, and includes time
the turn spends waiting on permissions or tools.

## Options

The end-of-turn toast is on by default. To keep the timer but silence the toast,
load the plugin from `opencode.json` instead of a symlink and pass `notify`:

```jsonc
{
  "plugins": [
    {
      "package": "./plugins/turn-timer",
      "options": { "notify": false },
    },
  ],
}
```

A plugin discovered under `~/.config/opencode/plugins/` is loaded without options,
so it uses the default and shows the toast.

## How it is built

The plugin subscribes to the server event stream with `context.data.listen`, keeps
the turn state in `context.storage.memory`, and contributes one `<text>` to the
`prompt.footer.status` slot. Nothing is written to the session or to disk.
