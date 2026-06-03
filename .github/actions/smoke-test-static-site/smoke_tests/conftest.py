"""Shared fixtures and configuration for static site smoke tests.

All configuration is read from environment variables set by the composite action:
  SITE_URL                  - Base URL of the deployed site (required)
  ADDITIONAL_URLS           - Newline-separated URLs to check for HTTP 200
  EXPECTED_SECURITY_HEADERS - Comma-separated header names that must be present
  REQUEST_TIMEOUT           - Per-request timeout in seconds (default: 15)
"""

from __future__ import annotations

import os
import time

import pytest
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        pytest.fail(f"Required environment variable {name} is not set")
    return value


# ---------------------------------------------------------------------------
# Fixtures: configuration
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def site_url() -> str:
    """Base URL of the deployed static site."""
    return _require_env("SITE_URL").rstrip("/")


@pytest.fixture(scope="session")
def request_timeout() -> int:
    """Per-request timeout in seconds."""
    return int(os.environ.get("REQUEST_TIMEOUT", "15"))


@pytest.fixture(scope="session")
def expected_security_headers() -> list[str]:
    """Security headers that must be present in responses."""
    raw = os.environ.get(
        "EXPECTED_SECURITY_HEADERS",
        "strict-transport-security,content-security-policy,"
        "x-content-type-options,x-frame-options,"
        "referrer-policy,permissions-policy",
    )
    return [h.strip().lower() for h in raw.split(",") if h.strip()]


@pytest.fixture(scope="session")
def additional_urls() -> list[str]:
    """Extra URLs (beyond the homepage) to verify return HTTP 200."""
    raw = os.environ.get("ADDITIONAL_URLS", "")
    return [url.strip() for url in raw.splitlines() if url.strip()]


# ---------------------------------------------------------------------------
# Fixtures: HTTP session with retry
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def http_session() -> requests.Session:
    """A requests Session with automatic retry on transient errors.

    Retries up to 3 times with exponential backoff (1s, 2s, 4s) on
    502, 503, and 504 status codes. This handles brief CloudFront
    propagation windows without relying solely on a fixed sleep.
    """
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[502, 503, 504],
        allowed_methods=["GET", "HEAD"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


# ---------------------------------------------------------------------------
# Fixtures: cached responses (hit the server once, reuse across tests)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def homepage_response(
    http_session: requests.Session,
    site_url: str,
    request_timeout: int,
) -> requests.Response:
    """GET the homepage. Cached for the entire test session."""
    return http_session.get(site_url, timeout=request_timeout)


@pytest.fixture(scope="session")
def homepage_headers(
    http_session: requests.Session,
    site_url: str,
    request_timeout: int,
) -> requests.structures.CaseInsensitiveDict:
    """Response headers from a HEAD request to the homepage.

    Uses HEAD to avoid transferring the body when we only need headers.
    """
    response = http_session.head(site_url, timeout=request_timeout)
    return response.headers


# ---------------------------------------------------------------------------
# Parametrize helpers
# ---------------------------------------------------------------------------


def pytest_generate_tests(metafunc: pytest.Metafunc) -> None:
    """Dynamically parametrize tests that request certain fixtures."""

    if "additional_url" in metafunc.fixturenames:
        raw = os.environ.get("ADDITIONAL_URLS", "")
        urls = [url.strip() for url in raw.splitlines() if url.strip()]
        if urls:
            metafunc.parametrize("additional_url", urls, ids=urls)
        else:
            metafunc.parametrize("additional_url", [pytest.param("", marks=pytest.mark.skip("No additional URLs provided"))])

    if "security_header" in metafunc.fixturenames:
        raw = os.environ.get(
            "EXPECTED_SECURITY_HEADERS",
            "strict-transport-security,content-security-policy,"
            "x-content-type-options,x-frame-options,"
            "referrer-policy,permissions-policy",
        )
        headers = [h.strip().lower() for h in raw.split(",") if h.strip()]
        metafunc.parametrize("security_header", headers)

    if "leaked_header" in metafunc.fixturenames:
        leaked = ["x-amz-server-side-encryption", "x-amz-version-id"]
        metafunc.parametrize("leaked_header", leaked)
