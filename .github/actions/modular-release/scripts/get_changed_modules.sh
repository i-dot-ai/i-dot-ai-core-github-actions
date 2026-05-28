#!/usr/bin/env bash
# Detects which modules have changed in the merged commit (HEAD..HEAD~1),
# excluding test directories.
#
# Reads the manifest to determine the module set and (for nested manifests
# like the Terraform-modules layout) the per-module group directory.
#
# Usage:
#   get_changed_modules.sh <manifest-path> <packages-dir>
#
# When <packages-dir> is set, all modules are assumed to live directly under
# it (the Node/Python case, e.g. `packages/auth`). When empty, the script
# walks the manifest's nested groups and uses each group key as the
# directory name (the Terraform case, e.g. `modules/infrastructure/rds`).
#
# Emits a space-separated list of module names to stdout.

set -euo pipefail

manifest="${1:-modules.yml}"
packages_dir="${2:-}"

if [ ! -f "$manifest" ]; then
  echo "Manifest not found at $manifest" >&2
  exit 1
fi

# List every leaf module name from the manifest. Tolerant of either a top-level
# `modules:` key or a bare mapping.
list_modules() {
  python3 - "$manifest" <<'PY'
import sys, yaml
with open(sys.argv[1]) as f:
    data = yaml.safe_load(f)
root = data.get('modules', data) if isinstance(data, dict) else data
def walk(node, parent=''):
    out = []
    if isinstance(node, list):
        for v in node:
            out.append((parent, v))
    elif isinstance(node, dict):
        for k, v in node.items():
            new_parent = f"{parent}/{k}" if parent else k
            out += walk(v, new_parent)
    return out
for parent, name in walk(root):
    print(f"{parent}\t{name}")
PY
}

changed=()
while IFS=$'\t' read -r parent name; do
  if [ -n "$packages_dir" ]; then
    module_dir="${packages_dir}/${name}"
  else
    module_dir="${parent}/${name}"
  fi

  # Match any change under module_dir except files in __tests__ or tests dirs.
  if git diff --name-only HEAD HEAD~1 -- "$module_dir" \
      | grep -v -E "(^|/)(__tests__|tests)(/|$)" \
      | grep -q .; then
    changed+=("$name")
  fi
done < <(list_modules)

echo "${changed[@]:-}"
