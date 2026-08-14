#!/usr/bin/env bash
# Reports modules whose published package content changed between HEAD and its
# first parent.
#
# Usage: get_changed_modules.sh [manifest-path] [packages-dir]
#
# `manifest-path` defaults to modules.yml and accepts the formats documented by
# codegen/modules.js. A non-empty `packages-dir` places every module directly
# below that directory; otherwise nested manifest keys form the package path.
# Stdout is a space-separated module list, or an empty line when no module has
# non-test changes. Invalid manifests and unreachable parent commits fail
# non-zero.
#
# Requires Node and the installed codegen dependencies, because module names
# come from ../codegen/list-modules.js.

set -euo pipefail

manifest="${1:-modules.yml}"
packages_dir="${2:-}"
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

if [ ! -f "$manifest" ]; then
  echo "Manifest not found at $manifest" >&2
  exit 1
fi

if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "Cannot diff HEAD against its first parent. Check out at least two commits (fetch-depth: 2), or confirm HEAD is not the repository's first commit." >&2
  exit 1
fi

module_list=$(node "$script_dir/../codegen/list-modules.js" "$manifest")
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
