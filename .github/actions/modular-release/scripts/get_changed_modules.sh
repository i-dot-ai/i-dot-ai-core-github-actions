#!/usr/bin/env bash
# Reports modules whose published package content changed between HEAD and its
# first parent.
#
# Usage: get_changed_modules.sh [manifest-path] [packages-dir] [forced-modules]
#
# `manifest-path` defaults to modules.yml and accepts the formats documented by
# codegen/modules.js. A non-empty `packages-dir` places every module directly
# below that directory; otherwise nested manifest keys form the package path.
# A non-empty, space-separated `forced-modules` skips change detection and
# reports those modules instead; each must be named in the manifest.
# Stdout is a space-separated module list, or an empty line when no module has
# non-test changes. Invalid manifests, unknown forced modules, and unreachable
# parent commits fail non-zero.
#
# Requires Node and the installed codegen dependencies, because module names
# come from ../codegen/list-modules.js.

set -euo pipefail

manifest="${1:-modules.yml}"
packages_dir="${2:-}"
forced_modules="${3:-}"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if [ ! -f "$manifest" ]; then
  echo "Manifest not found at $manifest" >&2
  exit 1
fi

module_list=$(node "$script_dir/../codegen/list-modules.js" "$manifest")

if [ -n "${forced_modules// /}" ]; then
  known_names=$(cut -f2 <<< "$module_list")
  forced=()
  for name in $forced_modules; do
    if ! grep -qxF -- "$name" <<< "$known_names"; then
      echo "Forced module '$name' is not in $manifest" >&2
      exit 1
    fi
    [[ " ${forced[*]-} " == *" $name "* ]] && continue
    forced+=("$name")
  done
  echo "${forced[@]}"
  exit 0
fi

if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "Cannot diff HEAD against its first parent. Check out at least two commits (fetch-depth: 2), or confirm HEAD is not the repository's first commit." >&2
  exit 1
fi

changed=()
while IFS=$'\t' read -r parent name; do
  if [ -z "$name" ]; then
    continue
  fi

  if [ -n "$packages_dir" ]; then
    module_dir="${packages_dir}/${name}"
  else
    module_dir="${parent}/${name}"
  fi

  # The release policy excludes test-only paths from versioning signals.
  if git diff --name-only HEAD^ HEAD -- "$module_dir" \
      | grep -v -E "(^|/)(__tests__|tests)(/|$)" \
      | grep -q .; then
    changed+=("$name")
  fi
done <<< "$module_list"

echo "${changed[@]:-}"
