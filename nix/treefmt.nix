# One formatter per syntax in the repository: Nix, TypeScript/TSX and JSON through
# prettier, Markdown through prettier, shell through shfmt.
{ inputs, ... }:
{
  imports = [ inputs.treefmt-nix.flakeModule ];

  perSystem = {
    treefmt = {
      projectRootFile = "flake.nix";

      programs.nixfmt.enable = true;
      programs.prettier.enable = true;
      programs.shfmt.enable = true;

      settings.global.excludes = [
        "flake.lock"
        "result"
        "result-*"
        "node_modules"
        "bun.lock"
      ];
    };
  };
}
