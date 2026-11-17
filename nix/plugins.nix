# The set of plugins is the checkout itself: every directory under plugins/ is one
# plugin, named after the directory. Discovery happens once here so packages and
# checks cannot disagree about what exists.
#
# Plugins must be git-tracked, because flakes only see tracked files. That makes
# `git add plugins/<name>` the only registration step for a new plugin.
{ lib, ... }:
{
  options.opencode-plugins.names = lib.mkOption {
    type = lib.types.listOf lib.types.str;
    default = lib.attrNames (
      lib.filterAttrs (_: type: type == "directory") (builtins.readDir ../plugins)
    );
    defaultText = lib.literalExpression "builtins.attrNames (readDir ../plugins)";
    description = ''
      Plugin directory names under plugins/, in the order the flake exposes them.
      Override to build or check only a subset.
    '';
  };
}
