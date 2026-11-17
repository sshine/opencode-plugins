# @nemlig/opencode-cut-paste-plugin

Emacs/readline-style kill and yank for [OpenCode](https://opencode.ai/)'s TUI.

## Bindings

| Key | Action |
| --- | --- |
| `ctrl+u` | Kill from the cursor to the start of the line, or kill the selection |
| `ctrl+k` | Kill from the cursor to the end of the line, or kill the selection |
| `ctrl+y` | Yank the last killed text |

Killed text is kept in a single in-process kill buffer and is also written to the system clipboard and the terminal via OSC 52. Yank prefers the in-process buffer, so it works instantly even when the system clipboard is unavailable (for example over SSH).

The bindings apply to every OpenUI textarea in the TUI, not only the prompt.

## Install

Install the published package as a TUI plugin:

```sh
opencode plugin add @nemlig/opencode-cut-paste-plugin
```

The package is published to GitHub Packages, so `~/.npmrc` needs the `@nemlig`
scope wired up and a `read:packages` token:

```sh
echo '@nemlig:registry=https://npm.pkg.github.com' >> ~/.npmrc
```

Add the plugin to `~/.config/opencode/cli.json` so it stays active against
remote servers:

```json
{
  "plugins": ["@nemlig/opencode-cut-paste-plugin"]
}
```

No build step or `bun install` is required: the package ships `tui.ts` as-is.

### From a checkout

```sh
mkdir -p ~/.config/opencode/plugins
git clone git@github.com:nemlig/ai.opencode-cut-paste-plugin.git \
  ~/.config/opencode/plugins/cut-paste-plugin
```

Restart OpenCode. To uninstall, remove the directory and restart.

## Compatibility

Tested with OpenCode `2.0.32`. The plugin uses OpenTUI's public `renderer.currentFocusedEditor` API and OpenCode's TUI keymap API.

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
