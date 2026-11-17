# Turn brief

A model-written brief for each completed [OpenCode](https://opencode.ai/)
turn, shown one line below the assistant's `Build · ...` footer in the
transcript. It wraps across as many lines as the brief needs.

```text
Build · DeepSeek V4.1 Flash 1017 · 56.2s · 101.5 tok/s · 1.9s ttft

Brief: Added zoxide to modules/zsh.nix with its shell init and verified it
against nixosConfigurations.t14
```

`Brief:` is bold; the rest is in the muted transcript colour.

- When a turn succeeds, fails or is interrupted, the turn's messages are sent
  to the model you configure, and the answer replaces the previous brief.
- While the summary is being written, it reads `Brief: summarizing…`.
- The brief is kept per session, so concurrent tabs do not overwrite each other.
- The brief is removed when the next turn starts, and placed back when that
  turn ends.
- Subagent turns are skipped by default; they show up in the parent transcript
  as tool calls.

The transcript is host-owned: OpenCode 2.3.0 has no public slot at the end of the
transcript, only one above the prompt. The plugin therefore appends a text node
to the session scrollbox's content. If OpenCode changes that internal layout, the
plugin falls back to the `session.composer.top` slot, which is above the prompt
instead of under the footer. Set `placement: "composer"` to use that supported
slot deliberately.

## Configure a model

The plugin makes a model call, so it deliberately does nothing until you name a
model. There is no default, to avoid spending money on every turn by accident.
Configure a small, fast model through `cli.json`:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "/home/me/opencode-plugins/plugins/turn-brief",
      "options": {
        "model": "opencode-go/claude-haiku-5-5",
      },
    },
  ],
}
```

`model` is `providerID/modelID`, matching the IDs that `opencode models` lists.
`model: "default"` lets OpenCode pick the default model instead, and an
`OPENCODE_TURN_BRIEF_MODEL` environment variable works as a fallback when the
plugin is discovered from `~/.config/opencode/plugins/` without options.

The call goes through OpenCode's stateless `generate.text` endpoint, so it uses
the providers and credentials already configured for OpenCode. It is resolved
against the global configuration, not a project's provider overrides. No session
is created and nothing is added to your conversation.

## Options

| Option               | Default      | Meaning                                                       |
| -------------------- | ------------ | ------------------------------------------------------------- |
| `model`              | none         | `providerID/modelID`, or `"default"`                          |
| `variant`            | none         | Model variant to request                                      |
| `prompt`             | built in     | Instruction sent before the transcript                        |
| `maxChars`           | `400`        | Soft character limit; `0` disables it                         |
| `maxTranscriptChars` | `12000`      | Transcript budget; the middle is dropped when it is longer    |
| `timeout`            | `30000`      | Milliseconds before the request is aborted                    |
| `subagents`          | `false`      | Also summarize child-session turns                            |
| `placement`          | `transcript` | `transcript` under the footer, or `composer` above the prompt |

## Privacy

The user prompt for the turn, the assistant's text, and the inputs of tool calls
(for example commands and file paths) are sent to the model you configure. Set
`maxTranscriptChars` lower if that is too much; the built-in instruction keeps
the answer short, but the input is the whole turn.

## How it is built

The plugin subscribes to `session.execution.succeeded`, `.failed` and
`.interrupted`, syncs the session's messages, builds a compact transcript from
the last user message onward, and calls `context.client.generate.text`. The
result is painted into a plugin text node appended to the session scrollbox, or
into the `session.composer.top` slot when the scrollbox is unavailable or
`placement` is `composer`. Requests are aborted when a newer turn starts or the
plugin unloads, so a slow model cannot overwrite a fresher brief.
