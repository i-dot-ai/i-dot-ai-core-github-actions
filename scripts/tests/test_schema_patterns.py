"""Data-quality regex tests for context-index.schema.json patterns.

Run with: pytest -q scripts/tests/test_schema_patterns.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest


SCHEMA_PATH = Path(__file__).resolve().parent.parent.parent / "schemas" / "context-index.schema.json"


@pytest.fixture(scope="module")
def schema() -> dict:
    with SCHEMA_PATH.open() as f:
        return json.load(f)


@pytest.fixture(scope="module")
def capability_id_re(schema: dict) -> re.Pattern[str]:
    return re.compile(schema["properties"]["capability_id"]["pattern"])


@pytest.fixture(scope="module")
def detail_ref_re(schema: dict) -> re.Pattern[str]:
    return re.compile(schema["properties"]["detail_ref"]["pattern"])


@pytest.fixture(scope="module")
def last_updated_re(schema: dict) -> re.Pattern[str]:
    return re.compile(schema["properties"]["last_updated"]["pattern"])


@pytest.mark.parametrize("value", ["CAP-000", "CAP-001", "CAP-099", "CAP-123", "CAP-999"])
def test_capability_id_accepts_three_digit_form(capability_id_re: re.Pattern[str], value: str) -> None:
    assert capability_id_re.fullmatch(value) is not None


@pytest.mark.parametrize(
    "value",
    [
        "CAP-1",
        "CAP-12",
        "CAP-1234",
        "cap-001",
        "CAPABILITY-001",
        "CAP_001",
        "CAP-001 ",
        " CAP-001",
        "",
    ],
)
def test_capability_id_rejects_other_forms(capability_id_re: re.Pattern[str], value: str) -> None:
    assert capability_id_re.fullmatch(value) is None


@pytest.mark.parametrize(
    "value",
    [
        "2026-05-15T09:00:00Z",
        "2026-05-15T09:00:00.000Z",
        "2026-12-31T23:59:59Z",
    ],
)
def test_last_updated_accepts_iso_utc_with_z(last_updated_re: re.Pattern[str], value: str) -> None:
    assert last_updated_re.fullmatch(value) is not None


@pytest.mark.parametrize(
    "value",
    [
        "2026-05-15T09:00:00",
        "2026-05-15T09:00:00+00:00",
        "2026-05-15 09:00:00Z",
        "2026-05-15",
        "not-a-timestamp",
    ],
)
def test_last_updated_rejects_other_forms(last_updated_re: re.Pattern[str], value: str) -> None:
    assert last_updated_re.fullmatch(value) is None


@pytest.mark.parametrize(
    "value",
    [
        "s3://platform-context/capabilities/CAP-002/detail.yaml",
        "s3://my-bucket-1/capabilities/CAP-006/detail.yaml",
        "s3://a.b.c/x.yaml",
    ],
)
def test_detail_ref_accepts_s3_uri(detail_ref_re: re.Pattern[str], value: str) -> None:
    assert detail_ref_re.fullmatch(value) is not None


@pytest.mark.parametrize(
    "value",
    [
        "https://example.com/x.yaml",
        "platform-context/capabilities/CAP-002/detail.yaml",
        "s3://platform-context/capabilities/CAP-002/detail.json",
        "S3://platform-context/capabilities/CAP-002/detail.yaml",
    ],
)
def test_detail_ref_rejects_other_uris(detail_ref_re: re.Pattern[str], value: str) -> None:
    assert detail_ref_re.fullmatch(value) is None
