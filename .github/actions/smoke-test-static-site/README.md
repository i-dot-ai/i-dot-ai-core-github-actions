# Smoke Test Static Site

Generic smoke tests for static sites deployed behind CloudFront + S3.

## What it tests

- Homepage returns HTTP 200
- Non-existent path returns HTTP 404
- Security headers present (configurable)
- S3 origin headers stripped (`x-amz-*`, `Server` != `AmazonS3`)
- Gzip compression enabled (warning only)
- Additional caller-supplied URLs return HTTP 200

## Usage in a reusable workflow

```yaml
smoke-test:
  runs-on: ubuntu-latest
  permissions:
    checks: write  # Required for JUnit test summary
  steps:
    - name: Run smoke tests
      uses: i-dot-ai/i-dot-ai-core-github-actions/.github/actions/smoke-test-static-site@main
      with:
        site-url: https://my-site.static.dev.i.ai.gov.uk
        additional-urls: |
          https://my-site.static.dev.i.ai.gov.uk/about/
          https://my-site.static.dev.i.ai.gov.uk/docs/
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `site-url` | Yes | — | Base URL of the deployed site |
| `additional-urls` | No | `""` | Newline-separated URLs to check for HTTP 200 |
| `expected-security-headers` | No | `strict-transport-security,content-security-policy,x-content-type-options,x-frame-options,referrer-policy,permissions-policy` | Comma-separated headers that must be present |
| `propagation-delay` | No | `30` | Seconds to wait for CloudFront propagation |
| `request-timeout` | No | `15` | Per-request timeout in seconds |

## Running locally

```bash
pip install -r requirements.txt

SITE_URL=https://my-site.static.dev.i.ai.gov.uk \
python -m pytest smoke_tests/ -v
```

With additional URLs:

```bash
SITE_URL=https://my-site.static.dev.i.ai.gov.uk \
ADDITIONAL_URLS=$'https://my-site.static.dev.i.ai.gov.uk/about/\nhttps://my-site.static.dev.i.ai.gov.uk/docs/' \
python -m pytest smoke_tests/ -v
```
