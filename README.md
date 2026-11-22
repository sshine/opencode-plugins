# opencode-plugins

A handful of [OpenCode](https://opencode.ai/) V2 plugins and agents.

- One directory per plugin under [`plugins/`](plugins/),
- One Markdown file per agent under [`agents/`](agents/),

| Plugin                                         | What it does                                                   |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [`cut-paste`](plugins/cut-paste)               | Cut and paste with `ctrl+u` / `ctrl+k` / `ctrl+y` in the TUI   |
| [`turn-timer`](plugins/turn-timer)             | A live timer for the current turn, plus how long it took       |
| [`turn-brief`](plugins/turn-brief)             | A model-written brief per turn, plus `/brief` for the session  |
| [`terminal-title`](plugins/terminal-title)     | A rolling whole-session summary in the terminal title          |
| [`session-location`](plugins/session-location) | Keeps the working directory visible while a turn runs          |
| [`session-activity`](plugins/session-activity) | The running turn's current action in the composer's model line |
| [`spinner-blips`](plugins/spinner-blips)       | A red Knight Rider blip that sweeps three times each way       |

Agents:

| Agent                      | What it does                                                               |
| -------------------------- | -------------------------------------------------------------------------- |
| [`think`](agents/think.md) | Answers questions and searches the web, keeping notes in its own directory |

## Install

### From a checkout

```sh
git clone git@github.com:sshine/opencode-plugins.git
cd opencode-plugins
./scripts/link-plugins.sh # or: just link-plugins
./scripts/link-agents.sh  # or: just link-agents
```

The plugin script symlinks every `plugins/<name>` into `${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins/<name>`.

The agent script symlinks every `agents/<name>.md` into `${XDG_CONFIG_HOME:-$HOME/.config}/opencode/agents/<name>.md`.

Set `OPENCODE_PLUGINS_DIR` or `OPENCODE_AGENTS_DIR` to link somewhere else. OpenCode discovers the plugins and agents
like any local ones, and `/reload` picks up edits without a build step.

Remove the links again with

- `./scripts/link-plugins.sh --remove` (or `just unlink-plugins`) and
- `./scripts/link-agents.sh --remove` (or `just unlink-agents`).

### `opencode plugin add`

OpenCode V2 can install a plugin from an npm or Git package specifier:

```sh
opencode plugin add opencode-turn-timer-plugin
```

That also records the plugin in the global config and keeps it updated. It needs one published npm
package per plugin, which this repository is laid out for but does not do yet. Until the packages
are published, the symlink script is the shortest path.

## Adding a plugin

1. Create `plugins/<name>/` with a `package.json` that exports `./tui`, and a
   `tui.ts` or `tui.tsx` beside it. See the [TUI plugin API][tui-plugin-api].
2. Add a row to the table above.

[tui-plugin-api]: https://opencode.ai/docs/build/plugins/cli

## Adding an agent

1. Create `agents/<name>.md` with V2 frontmatter (`description`, `mode`, `permissions`)
   and the system prompt as the document body. See [Agents][opencode-agents]
2. Add a row to the agents table above.

[opencode-agents]: https://opencode.ai/docs/agents

## Development

```sh
nix develop     # bun, just, treefmt, deadnix, oxlint, hk
just typecheck  # tsc over every plugin
just lint       # deadnix over Nix, oxlint over TypeScript
just fmt        # treefmt: nixfmt, prettier, shfmt
just check      # nix flake check
just ci         # fmt-check, lint, typecheck and check
```

The Nix side is a [dendritic flake](https://github.com/vic/import-tree): every file under
[`nix/`](nix) is a flake-parts module, discovered with `import-tree`, so a concern lives in one file
and adding one is adding a file. The plugin list itself is discovered once in `nix/plugins.nix` and
read by the package and check modules.

## Compatibility

Built for OpenCode `2.3.x`'s TUI plugin API.
