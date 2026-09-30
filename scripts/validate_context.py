#!/usr/bin/env python3
"""validate_context.py — validate a context record against its JSON Schema.

Usage:
  validate_context.py --layer index|detail PATH [--strict|--no-strict]

Exit codes:
  0  record is valid
  1  record is invalid (or file/schema error)
  2  CLI usage error

The script is the canonical validator wired into CI for the
i-dot-ai-core-github-actions repository. It runs in --strict mode
by default; --no-strict is an explicit opt-out documented in the
slice scope. Strict mode currently differs from non-strict mode by
one behaviour: in strict mode an unknown top-level field produces a
non-empty stderr report with the exact rejected key path; in
non-strict mode the same condition still fails (additionalProperties:
false at the schema root) but the stderr report is suppressed to a
single summary line. The schema's own constraints are unchanged.

Authored under SLICE-001 of EXEC-20260515-platform-context-management.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator


SCHEMA_DIR = Path(__file__).resolve().parent.parent / "schemas"

LAYER_TO_SCHEMA = {
    "index": SCHEMA_DIR / "context-index.schema.json",
    "detail": SCHEMA_DIR / "context-detail.schema.json",
}


def _load_yaml(path: Path) -> object:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_schema(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _format_error(err) -> str:
    location = "/".join(str(p) for p in err.absolute_path) or "<root>"
    return f"{location}: {err.message}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate a context record against its JSON Schema.",
    )
    parser.add_argument(
        "--layer",
        required=True,
        choices=sorted(LAYER_TO_SCHEMA.keys()),
        help="Which layer schema to validate against.",
    )
    parser.add_argument(
        "path",
        type=Path,
        help="Path to the YAML record to validate.",
    )
    strict_group = parser.add_mutually_exclusive_group()
    strict_group.add_argument(
        "--strict",
        dest="strict",
        action="store_true",
        help="Strict mode (default): emit a structured report on stderr for every error.",
    )
    strict_group.add_argument(
        "--no-strict",
        dest="strict",
        action="store_false",
        help="Opt-out of strict reporting; still validates, but stderr collapses to a single summary line.",
    )
    parser.set_defaults(strict=True)

    try:
        args = parser.parse_args(argv)
    except SystemExit as e:
        return int(e.code) if e.code is not None else 2

    schema_path = LAYER_TO_SCHEMA[args.layer]
    if not schema_path.exists():
        print(f"validator: schema not found: {schema_path}", file=sys.stderr)
        return 1

    if not args.path.exists():
        print(f"validator: record not found: {args.path}", file=sys.stderr)
        return 1

    try:
        schema = _load_schema(schema_path)
    except json.JSONDecodeError as e:
        print(f"validator: schema is not valid JSON ({schema_path}): {e}", file=sys.stderr)
        return 1

    try:
        record = _load_yaml(args.path)
    except yaml.YAMLError as e:
        print(f"validator: record is not valid YAML ({args.path}): {e}", file=sys.stderr)
        return 1

    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(record), key=lambda e: list(e.absolute_path))

    if not errors:
        return 0

    if args.strict:
        print(f"validator: {args.path} failed schema validation ({args.layer}):", file=sys.stderr)
        for err in errors:
            print(f"  - {_format_error(err)}", file=sys.stderr)
    else:
        print(
            f"validator: {args.path} failed schema validation ({len(errors)} errors)",
            file=sys.stderr,
        )

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
