#!/usr/bin/env bash
# publish_context.sh — helper script for the publish-context reusable workflow.
# Authored under SLICE-004a of EXEC-20260515-platform-context-management.
#
# Subcommands:
#   assert_capability_match <capability_id> <index_path> <detail_path>
#       Refuses if the capability_id field inside index/detail YAML does
#       NOT match the workflow input. Exits 1 on mismatch.
#
#   assert_schema_versions_match <index_path> <detail_path>
#       Refuses if the schema_version fields in the two layers differ.
#
#   canonicalise <index_path> <capability_id> <bucket> <actor>
#       Rewrites the Layer 1 detail_ref to s3://<bucket>/capabilities/
#       <capability_id>/detail.yaml in place. Sets last_updated to the
#       current UTC ISO 8601 timestamp and updated_by to <actor>.
#
#   emit_step_summary <capability_id> <index_path> <detail_path> <bucket>
#       Writes the canonical step summary line set to $GITHUB_STEP_SUMMARY.
#
# Style: bash -e, no AWS calls (those land in SLICE-004b/c). All YAML
# manipulation is via python -c with PyYAML so we keep one canonical
# parser and avoid yq quirks. Secrets are NEVER echoed; only logged
# field names and SHA256s.

set -euo pipefail

usage() {
    cat <<USAGE >&2
publish_context.sh <subcommand> [args...]

Subcommands:
  assert_capability_match     <capability_id> <index_path> <detail_path>
  assert_schema_versions_match <index_path> <detail_path>
  canonicalise                <index_path> <capability_id> <bucket> <actor>
  emit_step_summary           <capability_id> <index_path> <detail_path> <bucket>
USAGE
}

# --- assert_capability_match -------------------------------------------

cmd_assert_capability_match() {
    local input_id="${1:?capability_id required}"
    local index_path="${2:?index_path required}"
    local detail_path="${3:?detail_path required}"

    python3 - "$input_id" "$index_path" "$detail_path" <<'PY'
import sys

import yaml

input_id, index_path, detail_path = sys.argv[1:4]

def yaml_capability_id(path):
    with open(path, encoding="utf-8") as fh:
        record = yaml.safe_load(fh)
    if not isinstance(record, dict):
        print(f"::error title=Invalid YAML::{path} did not parse as a YAML mapping", file=sys.stderr)
        sys.exit(1)
    return record.get("capability_id")

index_id = yaml_capability_id(index_path)
detail_id = yaml_capability_id(detail_path)

if index_id != input_id:
    print(
        f"::error title=capability_id mismatch::Workflow input '{input_id}' "
        f"does not match capability_id in {index_path} ('{index_id}'). "
        f"The with: input is the source of truth.",
        file=sys.stderr,
    )
    sys.exit(1)
if detail_id != input_id:
    print(
        f"::error title=capability_id mismatch::Workflow input '{input_id}' "
        f"does not match capability_id in {detail_path} ('{detail_id}').",
        file=sys.stderr,
    )
    sys.exit(1)

print(f"::notice title=capability_id match::{input_id} in input matches both YAML layers.")
PY
}

# --- assert_schema_versions_match -------------------------------------

cmd_assert_schema_versions_match() {
    local index_path="${1:?index_path required}"
    local detail_path="${2:?detail_path required}"

    python3 - "$index_path" "$detail_path" <<'PY'
import sys

import yaml

index_path, detail_path = sys.argv[1:3]

def schema_version(path):
    with open(path, encoding="utf-8") as fh:
        record = yaml.safe_load(fh)
    return (record or {}).get("schema_version")

index_v = schema_version(index_path)
detail_v = schema_version(detail_path)
if index_v != detail_v:
    print(
        f"::error title=schema_version mismatch::Layer 1 declares "
        f"schema_version={index_v!r} but Layer 2 declares {detail_v!r}.",
        file=sys.stderr,
    )
    sys.exit(1)
print(f"::notice title=schema_version match::Both layers declare schema_version={index_v}")
PY
}

# --- canonicalise -----------------------------------------------------

cmd_canonicalise() {
    local index_path="${1:?index_path required}"
    local capability_id="${2:?capability_id required}"
    local bucket="${3:?bucket required}"
    local actor="${4:?actor required}"

    python3 - "$index_path" "$capability_id" "$bucket" "$actor" <<'PY'
import datetime as _dt
import sys

import yaml

index_path, capability_id, bucket, actor = sys.argv[1:5]

with open(index_path, encoding="utf-8") as fh:
    record = yaml.safe_load(fh)

original_detail_ref = record.get("detail_ref")
canonical = f"s3://{bucket}/capabilities/{capability_id}/detail.yaml"
record["detail_ref"] = canonical

# Set last_updated to current UTC ISO 8601, second precision, Z suffix.
now = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
record["last_updated"] = now

# updated_by: actor or 'github-actions[bot]'.
record["updated_by"] = actor or "github-actions[bot]"

with open(index_path, "w", encoding="utf-8") as fh:
    yaml.safe_dump(record, fh, sort_keys=False)

print(
    "::notice title=detail_ref canonicalised::"
    f"original={original_detail_ref!r} -> canonical={canonical!r}",
)
print(
    "::notice title=last_updated set by workflow::"
    f"{now} (updated_by={record['updated_by']})",
)
PY
}

# --- emit_step_summary -----------------------------------------------

cmd_emit_step_summary() {
    local capability_id="${1:?capability_id required}"
    local index_path="${2:?index_path required}"
    local detail_path="${3:?detail_path required}"
    local bucket="${4:-}"

    : "${GITHUB_STEP_SUMMARY:=/dev/stdout}"

    local layer1_sha layer2_sha schema_version detail_ref
    layer1_sha=$(sha256sum "$index_path" | awk '{print $1}')
    layer2_sha=$(sha256sum "$detail_path" | awk '{print $1}')
    schema_version=$(python3 -c '
import sys, yaml
with open(sys.argv[1], encoding="utf-8") as f:
    print((yaml.safe_load(f) or {}).get("schema_version"))
' "$index_path")
    detail_ref=$(python3 -c '
import sys, yaml
with open(sys.argv[1], encoding="utf-8") as f:
    print((yaml.safe_load(f) or {}).get("detail_ref"))
' "$index_path")

    {
        echo "## publish-context summary"
        echo ""
        echo "| Field | Value |"
        echo "|---|---|"
        echo "| capability_id | \`${capability_id}\` |"
        echo "| schema_version | \`${schema_version}\` |"
        echo "| layer1_sha256 | \`${layer1_sha}\` |"
        echo "| layer2_sha256 | \`${layer2_sha}\` |"
        echo "| detail_ref | \`${detail_ref}\` |"
        echo "| target bucket | \`${bucket}\` |"
        echo "| writes_stubbed | \`true\` (SLICE-004a; lifts at SLICE-004b/c) |"
    } >> "${GITHUB_STEP_SUMMARY}"
}

# --- dispatch ---------------------------------------------------------

if [ "$#" -lt 1 ]; then
    usage
    exit 2
fi

subcommand="$1"
shift
case "$subcommand" in
    assert_capability_match)        cmd_assert_capability_match "$@" ;;
    assert_schema_versions_match)   cmd_assert_schema_versions_match "$@" ;;
    canonicalise)                   cmd_canonicalise "$@" ;;
    emit_step_summary)              cmd_emit_step_summary "$@" ;;
    *)
        echo "publish_context.sh: unknown subcommand: $subcommand" >&2
        usage
        exit 2
        ;;
esac
