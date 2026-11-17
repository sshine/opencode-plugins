#!/usr/bin/env bash
#
# Link every plugin in this checkout into OpenCode's global plugin directory.
#
# OpenCode discovers each directory under its plugins directory, so a symlink per
# plugin keeps the checkout as the source of truth and /reload picks up edits.
#
#   ./scripts/link-plugins.sh           link every plugin
#   ./scripts/link-plugins.sh --remove  remove those links again
#
# Set OPENCODE_PLUGINS_DIR to target another directory.

set -euo pipefail

root=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
target=${OPENCODE_PLUGINS_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins}
remove=false

case ${1:-} in
--remove) remove=true ;;
"") ;;
*)
  echo "usage: $(basename "$0") [--remove]" >&2
  exit 2
  ;;
esac

mkdir -p "$target"

status=0
for source in "$root"/plugins/*/; do
  source=${source%/}
  name=$(basename "$source")
  link="$target/$name"

  if $remove; then
    if [[ -L $link && $(readlink "$link") == "$source" ]]; then
      rm "$link"
      echo "removed  $name"
    fi
    continue
  fi

  if [[ -L $link && $(readlink "$link") == "$source" ]]; then
    echo "ok       $name"
    continue
  fi

  if [[ -e $link && ! -L $link ]]; then
    echo "refusing to replace $link: it is not a symlink" >&2
    status=1
    continue
  fi

  ln -sfn "$source" "$link"
  echo "linked   $name -> $source"
done

if $remove && [[ -d $target ]] && [[ -z $(ls -A "$target") ]]; then
  rmdir "$target"
fi

exit "$status"
