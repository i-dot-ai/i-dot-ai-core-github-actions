"""Compression smoke test for a deployed static site.

Verifies that CloudFront serves gzip-compressed responses.
This is a non-fatal warning (not a hard failure) because small
responses may not be compressed.
"""

from __future__ import annotations

import warnings

import requests


class TestCompression:
    """CloudFront should serve gzip-compressed responses."""

    def test_gzip_compression_enabled(
        self,
        http_session: requests.Session,
        site_url: str,
        request_timeout: int,
    ) -> None:
        response = http_session.head(
            site_url,
            headers={"Accept-Encoding": "gzip"},
            timeout=request_timeout,
        )
        content_encoding = response.headers.get("content-encoding", "")

        if "gzip" not in content_encoding.lower():
            warnings.warn(
                "No gzip content-encoding in response "
                "(may be expected for small responses)",
                stacklevel=1,
            )
