"""Security header smoke tests for a deployed static site.

Verifies that:
- Expected security headers are present (configurable via input)
- S3 origin headers are stripped by CloudFront (hardcoded)
- The Server header does not leak the S3 origin
"""

from __future__ import annotations

import requests


class TestSecurityHeadersPresent:
    """Required security headers must be present in responses."""

    def test_security_header_present(
        self,
        homepage_headers: requests.structures.CaseInsensitiveDict,
        security_header: str,
    ) -> None:
        assert security_header in homepage_headers, (
            f"Missing required security header: {security_header}"
        )


class TestS3OriginHeadersStripped:
    """S3 origin headers must not leak through CloudFront."""

    def test_s3_origin_header_absent(
        self,
        homepage_headers: requests.structures.CaseInsensitiveDict,
        leaked_header: str,
    ) -> None:
        assert leaked_header not in homepage_headers, (
            f"S3 origin header should be stripped by CloudFront: {leaked_header}"
        )

    def test_server_header_not_amazons3(
        self,
        homepage_headers: requests.structures.CaseInsensitiveDict,
    ) -> None:
        server_value = homepage_headers.get("server", "")
        assert server_value != "AmazonS3", (
            "Server header is 'AmazonS3' - CloudFront should override this"
        )
