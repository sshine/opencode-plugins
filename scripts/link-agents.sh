#!/usr/bin/env bash
#
# Link every agent in this checkout into OpenCode's global agents directory.
#
# OpenCode discovers each Markdown file under its agents directory, so a symlink
# per agent keeps the checkout as the source of truth and config reloads pick up
# edits.
#
#   ./scripts/link-agents.sh           link every agent
#   ./scripts/link-agents.sh --remove  remove those links again
#
# Set OPENCODE_AGENTS_DIR to target another directory.

set -euo pipefail

root=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
target=${OPENCODE_AGENTS_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode/agents}
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
for source in "$root"/agents/*.md; do
  [[ -e $source ]] || continue
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
