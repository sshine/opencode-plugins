# Terminal title

A rolling summary of the whole [OpenCode](https://opencode.ai/) session in the
terminal title.

```text
$ tmux display -p '#{pane_title}'
Fixing the terminal title plugin
```

- After every completed turn, one model call folds that turn into the session's
  previous summary and writes a new title. The next call receives the updated
  summary, so the title follows the session as a whole instead of narrating the
  newest turn.
- The title is one line, with control characters and extra whitespace removed,
  and is capped at 60 characters by default.
- Every root session keeps its own summary. A completed turn in another tab is
  summarized, but the terminal title only changes when that session is the one
  on screen; switching to a session with a summary applies it.
- A turn that ends while that session's previous summary is still in flight is
  ignored rather than stacked. Model and network failures leave the last good
  title in place and never surface as a TUI error.
- State lives in plugin memory, so `/reload` keeps the rolling summary. A TUI
  restart starts over.
- Subagent turns are skipped; they already appear in the parent transcript as
  tool calls.

Like [`turn-brief`](../turn-brief), the plugin deliberately does nothing until
you name a model. There is no default, to avoid spending money on every turn by
accident.

## Configure a model

Configure a small, fast model through `cli.json`:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "/home/me/opencode-plugins/plugins/terminal-title",
      "options": {
        "model": "opencode-go/claude-haiku-5-5",
      },
    },
  ],
}
```

`model` is `providerID/modelID`, matching the IDs that `opencode models` lists.
`model: "default"` lets OpenCode pick the default model instead, and an
`OPENCODE_TERMINAL_TITLE_MODEL` environment variable works as a fallback when the
plugin is discovered from `~/.config/opencode/plugins/` without options.

Without a model the plugin warns once and leaves the title unchanged.

The call goes through OpenCode's stateless `generate.text` endpoint, so it uses
the providers and credentials already configured for OpenCode. It is resolved
against the global configuration, not a project's provider overrides. No session
is created and nothing is added to your conversation.

## Options

| Option               | Default  | Meaning                                                      |
| -------------------- | -------- | ------------------------------------------------------------ |
| `model`              | none     | `providerID/modelID`, or `"default"`                         |
| `variant`            | none     | Model variant to request                                     |
| `prompt`             | built in | Instruction sent before the previous summary and latest turn |
| `maxTitleChars`      | `60`     | Title character cap; `0` disables it                         |
| `maxSummaryChars`    | `600`    | Rolling summary budget; `0` disables it                      |
| `maxTranscriptChars` | `12000`  | Latest-turn transcript budget; the middle is dropped past it |
| `timeout`            | `30000`  | Milliseconds before the request is aborted                   |

## How the terminal title is set

The plugin calls `context.renderer.setTerminalTitle(title)` on the host's
OpenTUI `CliRenderer`. That is the supported renderer API, and it sends the
terminal's title sequence (OSC 0, which sets both the window title and the icon
name) through the same native session that paints the TUI. There is no escape
sequence composed by the plugin.

Some terminals and multiplexers intercept titles. tmux keeps the sequence as the
pane title unless its own title reporting is enabled (`set-titles on` with a
`set-titles-string`, for example). OpenCode can also write its own title when it
starts; this plugin only changes it after a turn ends. The plugin leaves the
title untouched on unload rather than guessing what the terminal had before.

## Privacy

The user prompt for the turn, the assistant's text, and the inputs of tool calls
(for example commands and file paths) are sent to the model you configure. The
rolling summary is sent back on every call. Set `maxTranscriptChars` lower if
that is too much.
