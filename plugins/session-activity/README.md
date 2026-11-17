# Session activity

Shows what the running turn is doing **now** in the composer's model line:

```text
Build · Thinking… · DeepSeek V4.1 Flash 1017 OpenCode Go · high
Build · Reading… · DeepSeek V4.1 Flash 1017 OpenCode Go · high
```

With `verbosity: low`, the transcript only tells you what has already finished,
so the spinner is the only signal that something is happening. This puts a word
where you are already looking: between the agent name and the model.

The words are `Thinking…` for reasoning or between steps, and `Composing…`
while the final answer streams. Tools map to a verb of their own:
`Calling the shell…` (`bash`), `Skimming…` (`read`), `Editing…`
(`edit`/`write`), `Patching…` (`apply_patch`), `Grepping…` (`grep`),
`Globbing…` (`glob`), `Listing…` (`list`), `Downloading…` (`webfetch`),
`Searching the web…` (`websearch`), `Delegating…` (`task`),
`Running code…` (`execute`), and `Tinkering…` for anything else. The word
disappears when the turn ends.

## Placement

OpenCode renders the model line itself and exposes no slot inside it. The plugin
finds the row by following the focused composer editor to the metadata row, then
inserts `·` and the activity word after the agent name. When that row cannot be
found — shell mode, a narrow layout, or a composer that has not mounted yet —
the same word is shown above the prompt through `session.composer.top`.

## Known problems with this placement

- **It is host-owned.** The row is not part of the plugin API. A future OpenCode
  release can move or rebuild it; the plugin detects a missing row and falls
  back, but the in-line word may stop appearing.
- **The row is responsive.** OpenCode drops the agent, provider or model from the
  row as the terminal narrows. The extra segment takes width too, so the model
  name can truncate earlier than it otherwise would.
- **Fade animation.** OpenCode fades the agent and model in when the composer
  mounts; the injected word uses normal theme colors and does not participate in
  that fade.
- **Structural assumptions.** The word is inserted after the first text in what
  looks like the agent-plus-model row. Shell mode and layouts without a `·`
  separator fall back to the line above the prompt.
- **Latency.** Events are coalesced for about 100 ms before the word is
  recomputed, so rapid tool transitions can lag one frame.

It updates from the session's message parts, not from a model call: a tool is
"running" while its state is `streaming` or `running`, reasoning is active until
it completes, and text is "responding" until its assistant message completes.
