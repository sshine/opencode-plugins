# The dev shell: bun for typechecking, the formatter wrapper, the linters, hk with
# its generated config baked in, and the commands the README tells people to run.
{ inputs, ... }:
{
  imports = [ inputs.devshell.flakeModule ];

  perSystem =
    { config, pkgs, ... }:
    {
      devshells.default = {
        packages = [
          config.treefmt.build.wrapper
          # The same hk the config generates, without applying hk-nix's overlay.
          config.hk-nix.hk
          pkgs.bun
          pkgs.deadnix
          pkgs.git
          pkgs.just
          pkgs.oxlint
        ];

        # `bun install` writes node_modules from the committed lock file; keep the
        # shell from also treating the store as a writable prefix.
        devshell.motd = "";
        devshell.startup.hk.text = config.hk-nix.shellHook;
      };
    };
}
