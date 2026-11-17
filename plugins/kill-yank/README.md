# opencode-kill-yank-plugin

Emacs/readline-style kill and yank for [OpenCode](https://opencode.ai/)'s TUI.

## Bindings

| Key      | Action                                                               |
| -------- | -------------------------------------------------------------------- |
| `ctrl+u` | Kill from the cursor to the start of the line, or kill the selection |
| `ctrl+k` | Kill from the cursor to the end of the line, or kill the selection   |
| `ctrl+y` | Yank the last killed text                                            |

Killed text is kept in a single in-process kill buffer and is also written to the system clipboard and the terminal via OSC 52. Yank prefers the in-process buffer, so it works instantly even when the system clipboard is unavailable (for example over SSH).

The bindings apply to every OpenUI textarea in the TUI, not only the prompt.

## Install

Clone the [plugin repository](https://github.com/sshine/opencode-plugins) and link
this directory into OpenCode's global plugin directory:

```sh
git clone git@github.com:sshine/opencode-plugins.git
cd opencode-plugins
./scripts/link-plugins.sh
```

That links every plugin in the repository, `kill-yank` included. To link only this
one, symlink `plugins/kill-yank` into `~/.config/opencode/plugins/kill-yank`
yourself. No build step or `bun install` is required.

To uninstall, remove the symlink and run `/reload` in OpenCode.

## Compatibility

Tested with OpenCode `2.0.32` and `2.3.0`. The plugin uses OpenTUI's public
`renderer.currentFocusedEditor` API and OpenCode's TUI keymap API.

## Notes

- The kill buffer is a single entry, not a full Emacs kill ring.
- `ctrl+u` and `ctrl+k` write to the clipboard asynchronously; yank still works immediately from the in-process buffer.
- If `ctrl+u` deletes twice, disable the built-in binding in `~/.config/opencode/cli.json`:

```json
{
  "keybinds": {
    "input.delete.to.line.start": "none"
  }
}
```
