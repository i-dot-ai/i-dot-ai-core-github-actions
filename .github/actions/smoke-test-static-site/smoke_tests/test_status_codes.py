"""HTTP status code smoke tests for a deployed static site."""

from __future__ import annotations

import time

import requests


class TestHomepage:
    """The site homepage must be reachable and return HTTP 200."""

    def test_homepage_returns_200(self, homepage_response: requests.Response) -> None:
        assert homepage_response.status_code == 200, (
            f"Homepage returned HTTP {homepage_response.status_code}, expected 200"
        )


class TestNotFound:
    """A clearly non-existent path must not return HTTP 200.

    S3 behind CloudFront with OAC returns 403 for missing objects (it won't
    confirm existence to an unauthorised caller). Sites with a custom error
    response configured will return 404 instead. Both are acceptable -- the
    important thing is that non-existent paths are not served as if they exist.
    """

    def test_nonexistent_path_does_not_return_200(
        self,
        http_session: requests.Session,
        site_url: str,
        request_timeout: int,
    ) -> None:
        nonexistent_url = f"{site_url}/_smoke-test-nonexistent-{int(time.time())}/"
        response = http_session.get(nonexistent_url, timeout=request_timeout)
        assert response.status_code in (403, 404), (
            f"Non-existent path returned HTTP {response.status_code}, "
            f"expected 403 or 404 - {nonexistent_url}"
        )


class TestAdditionalUrls:
    """Caller-supplied URLs must all return HTTP 200."""

    def test_additional_url_returns_200(
        self,
        http_session: requests.Session,
        additional_url: str,
        request_timeout: int,
    ) -> None:
        response = http_session.get(additional_url, timeout=request_timeout)
        assert response.status_code == 200, (
            f"{additional_url} returned HTTP {response.status_code}, expected 200"
        )
