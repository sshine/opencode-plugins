# opencode-cut-paste-plugin

Cut and paste for [OpenCode](https://opencode.ai/)'s TUI.

## Bindings

| Key      | Action                                                             |
| -------- | ------------------------------------------------------------------ |
| `ctrl+u` | Cut from the cursor to the start of the line, or cut the selection |
| `ctrl+k` | Cut from the cursor to the end of the line, or cut the selection   |
| `ctrl+y` | Paste the last cut text                                            |

Cut text is kept in a single in-process cut buffer and is also written to the system clipboard and the terminal via OSC 52. Paste prefers the in-process buffer, so it works instantly even when the system clipboard is unavailable (for example over SSH).

The bindings apply to every OpenUI textarea in the TUI, not only the prompt.

## Install

Clone the
[plugin repository](https://github.com/nemlig/ai.opencode-small-plugins) and
link this directory into OpenCode's global plugin directory:

```sh
git clone git@github.com:nemlig/ai.opencode-small-plugins.git
cd ai.opencode-small-plugins
./scripts/link-plugins.sh
```

That links every plugin in the repository, `cut-paste` included. To link only this
one, symlink `plugins/cut-paste` into `~/.config/opencode/plugins/cut-paste`
yourself. No build step or `bun install` is required.

To uninstall, remove the symlink and run `/reload` in OpenCode.

## Compatibility

Tested with OpenCode `2.0.32` and `2.3.0`. The plugin uses OpenTUI's public
`renderer.currentFocusedEditor` API and OpenCode's TUI keymap API.

## Notes

- The cut buffer is a single entry, not a history of cuts.
- `ctrl+u` and `ctrl+k` write to the clipboard asynchronously; paste still works immediately from the in-process buffer.
- If `ctrl+u` deletes twice, disable the built-in binding in `~/.config/opencode/cli.json`:

```json
{
  "keybinds": {
    "input.delete.to.line.start": "none"
  }
}
```
