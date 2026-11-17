# A manifest check per plugin, so a half-added directory fails with the reason
# rather than producing a plugin that silently loads nothing.
#
#   nix flake check
{ config, ... }:
let
  names = config.opencode-plugins.names;

  source = name: ../plugins + "/${name}";
in
{
  perSystem =
    { pkgs, lib, ... }:
    {
      checks = lib.genAttrs names (
        name:
        pkgs.runCommandLocal "check-opencode-plugin-${name}" { nativeBuildInputs = [ pkgs.jq ]; } ''
          manifest=${source name}/package.json

          if [ ! -f "$manifest" ]; then
            echo "plugins/${name} has no package.json" >&2
            exit 1
          fi

          entry="$(jq -r '.exports["./tui"] // empty' "$manifest")"
          if [ -z "$entry" ]; then
            echo "plugins/${name}/package.json must export \"./tui\"" >&2
            exit 1
          fi

          if [ ! -f "${source name}/$entry" ]; then
            echo "plugins/${name}/package.json exports $entry, which does not exist" >&2
            exit 1
          fi

          touch $out
        ''
      );
    };
}
