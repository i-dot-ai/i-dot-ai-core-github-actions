# Build and Deploy Static Site

Reusable workflow that builds a Node-based static site, syncs it to an environment-specific S3 bucket, invalidates the CloudFront cache, optionally smoke tests the deployed URL, and sends a Slack notification on success or failure.

## Usage

```yaml
jobs:
  deploy:
    uses: i-dot-ai/i-dot-ai-core-github-actions/.github/workflows/build-and-deploy-static-site.yml@main
    with:
      ENVIRONMENT: dev
      COMMIT_HASH: ${{ github.sha }}
      # Override defaults as needed:
      # NODE_VERSION: "22"
      # BUILD_COMMAND: "cd frontend && npm run build"
      # SITE_URL: "https://my-site.example.com"
      # BUILD_ENV_VARS: ${{ vars.BUILD_ENV_VARS }}
    secrets: inherit
```

With smoke tests enabled:

```yaml
jobs:
  deploy:
    uses: i-dot-ai/i-dot-ai-core-github-actions/.github/workflows/build-and-deploy-static-site.yml@main
    with:
      ENVIRONMENT: dev
      COMMIT_HASH: ${{ github.sha }}
      SITE_URL: https://my-site.static.dev.i.ai.gov.uk
      SMOKE_TEST_URLS: |
        https://my-site.static.dev.i.ai.gov.uk/about/
        https://my-site.static.dev.i.ai.gov.uk/docs/
    secrets: inherit
```

## Required inputs

| Input | Description |
|---|---|
| `ENVIRONMENT` | Target environment (`dev`, `preprod`, or `prod`). |
| `COMMIT_HASH` | Git SHA to checkout and deploy. |

## Required secrets

All required secrets are handled centrally via organisational level secrets. You don't have to configure any secrets within your repository to use this workflow. If you think these need changing, contact the platform team via the **#platform** Slack channel.

These are marked as `required: false` in the workflow definition, but the **build will fail** at the "Validate environment-specific secrets" step if the pair for the target environment is missing.

## Optional inputs and defaults

| Input | Default | Notes |
|---|---|---|
| `SITE_PREFIX` | Calling repository name | S3 key prefix. Must match the key for your site in the [core-static-site/config/<env>/sites.yaml](https://github.com/i-dot-ai/core-static-site/blob/main/config/dev/sites.yaml). |
| `NODE_VERSION` | `latest` | **Recommend pinning to an LTS version** (e.g. `22`) to avoid unexpected breakages. |
| `INSTALL_COMMAND` | `cd frontend && npm install` | Override if your project structure differs. |
| `BUILD_COMMAND` | `cd frontend && npm run build` | Override if your project structure differs. |
| `BUILD_DIRECTORY` | `frontend/dist` | Path to the build output. If you change `BUILD_COMMAND`, you likely need to change this too. |
| `BUILD_ENV_VARS` | _(none)_ | Newline-separated `KEY=VALUE` pairs written to a `.env` file before the build step. Use for build-time configuration (e.g. base URLs, feature flags). These values are baked into the static output and are **not secret**. If you manage these per environment, pass `${{ vars.BUILD_ENV_VARS }}` from your caller (see [Per-environment build variables](#per-environment-build-variables) below). |
| `SITE_URL` | _(none)_ | If provided, enables the smoke test job. |
| `SMOKE_TEST_URLS` | _(none)_ | Newline-separated list of additional URLs to check for HTTP 200 (e.g. sub-pages, static assets). Only used when `SITE_URL` is set. |

## Per-environment build variables

If you need different build-time configuration per environment (e.g. different API base URLs for `dev` vs `prod`), you need to configure set jobs and pass these through as separate inputs. 

## Caller permissions

If you use `SITE_URL` to enable smoke tests, the calling workflow must grant `checks: write` so the JUnit test summary can be published:

```yaml
permissions:
  contents: read
  id-token: write
  checks: write
```
