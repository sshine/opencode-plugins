# Git hooks via hk-nix: formatting on commit, dead code and TypeScript lint on
# push, and conventional commit messages. treefmt stays the single source of truth
# for formatting, so the hook runs the wrapper rather than individual formatters.
{ inputs, ... }:
{
  imports = [ inputs.hk-nix.flakeModules.default ];

  perSystem =
    {
      config,
      lib,
      pkgs,
      ...
    }:
    let
      treefmt = lib.getExe config.treefmt.build.wrapper;
    in
    {
      hk-nix.settings.hooks = {
        pre-commit = {
          fix = true;
          stash = "git";
          steps.treefmt = {
            check = "${treefmt} --fail-on-change --no-cache {{files}}";
            fix = "${treefmt} {{files}}";
          };
        };

        pre-push.steps = {
          deadnix = {
            glob = "*.nix";
            check = "${lib.getExe pkgs.deadnix} --fail {{files}}";
          };

          oxlint = {
            glob = "*.ts*";
            check = "${lib.getExe pkgs.oxlint} --deny-warnings {{files}}";
          };
        };

        commit-msg.steps.conventional.builtin = config.hk-nix.builtins.check_conventional_commit;
      };
    };
}
