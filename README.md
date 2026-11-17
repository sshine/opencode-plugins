# opencode-plugins

A handful of [OpenCode](https://opencode.ai/) V2 plugins that I use daily. One
directory per plugin under [`plugins/`](plugins/), everything else is tooling.

| Plugin                                         | What it does                                                   |
| ---------------------------------------------- | -------------------------------------------------------------- |
| [`kill-yank`](plugins/kill-yank)               | Emacs/readline-style `ctrl+u` / `ctrl+k` / `ctrl+y` in the TUI |
| [`turn-timer`](plugins/turn-timer)             | A live timer for the current turn, plus how long it took       |
| [`turn-brief`](plugins/turn-brief)             | A model-written brief for each completed turn                  |
| [`session-location`](plugins/session-location) | Keeps the working directory visible while a turn runs          |
| [`session-activity`](plugins/session-activity) | The running turn's current action in the composer's model line |
| [`spinner-blips`](plugins/spinner-blips)       | A red Knight Rider blip that sweeps three times each way       |

## Install

### From a checkout

```sh
git clone git@github.com:sshine/opencode-plugins.git
cd opencode-plugins
./scripts/link-plugins.sh # or: just link
```

The script symlinks every `plugins/<name>` into
`${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins/<name>`. Set
`OPENCODE_PLUGINS_DIR` to link somewhere else. OpenCode discovers the plugins
like any local plugin, and `/reload` picks up edits without a build step.

Remove the links again with `./scripts/link-plugins.sh --remove` (or `just
unlink`).

`turn-brief` makes a model call and therefore needs a model configured before it
does anything; see [its README](plugins/turn-brief#configure-a-model). Linking it
without one is harmless: it warns once and makes no calls.

### From Nix

Every plugin is a flake package named after its directory:

```sh
nix build .#turn-timer
ln -sfn "$(readlink -f result)" ~/.config/opencode/plugins/turn-timer
```

A declarative setup can point a home-manager or hjem file at the same package:

```nix
".config/opencode/plugins/turn-timer".source =
  inputs.opencode-plugins.packages.${pkgs.stdenv.hostPlatform.system}.turn-timer;
```

The flake also provides `nix develop` (bun, just, treefmt, hk) and `nix fmt`.

### Eventually: `opencode plugin add`

OpenCode V2 can install a plugin from an npm or Git package specifier:

```sh
opencode plugin add opencode-turn-timer-plugin
```

That also records the plugin in the global config and keeps it updated. It needs
one published npm package per plugin, which this repository is laid out for but
does not do yet. Until the packages are published, the symlink script is the
shortest path.

## Adding a plugin

1. Create `plugins/<name>/` with a `package.json` that exports `./tui`, and a
   `tui.ts` or `tui.tsx` beside it. See the
   [TUI plugin API](https://opencode.ai/docs/build/plugins/cli).
2. Run `git add plugins/<name>`. The flake discovers directories under
   `plugins/`, so `nix build .#<name>` and `just link` work without edits
   anywhere else.
3. Add a row to the table above.

## Development

```sh
nix develop     # bun, just, treefmt, hk
just typecheck  # tsc over every plugin
just fmt        # treefmt: nixfmt, prettier, shfmt
just check      # nix flake check
just ci         # what CI should run
```

The Nix side is a [dendritic flake](https://github.com/vic/import-tree): every
file under [`nix/`](nix) is a flake-parts module, discovered with `import-tree`,
so a concern lives in one file and adding one is adding a file. The plugin list
itself is discovered once in `nix/plugins.nix` and read by the package and check
modules.

## Compatibility

Built for OpenCode `2.3.0`'s TUI plugin API. The plugins are TUI-only packages.
