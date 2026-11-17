# One package per plugin, named after its directory: `nix build .#turn-timer`.
#
# The package is the plugin directory copied into the store, package.json and all,
# so it can be symlinked into ~/.config/opencode/plugins exactly like a checkout
# directory. OpenCode resolves the entry point through package.json's exports map.
{ config, ... }:
let
  names = config.opencode-plugins.names;

  source = name: ../plugins + "/${name}";
in
{
  perSystem =
    { pkgs, lib, ... }:
    {
      packages = lib.genAttrs names (
        name:
        pkgs.runCommandLocal "opencode-plugin-${name}" { } ''
          mkdir -p $out
          cp -R ${source name}/. $out/
        ''
      );
    };
}
