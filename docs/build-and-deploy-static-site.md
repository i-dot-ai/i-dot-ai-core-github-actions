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
    secrets:
      AWS_GITHUBRUNNER_PAT: ${{ secrets.AWS_GITHUBRUNNER_PAT }}
      AWS_REGION: ${{ secrets.AWS_REGION }}
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      STATIC_SITE_DEV_DESTINATION_BUCKET: ${{ secrets.STATIC_SITE_DEV_DESTINATION_BUCKET }}
      STATIC_SITE_DEV_CLOUDFRONT_DISTRIBUTION_ID: ${{ secrets.STATIC_SITE_DEV_CLOUDFRONT_DISTRIBUTION_ID }}
```

## Required inputs

| Input | Description |
|---|---|
| `ENVIRONMENT` | Target environment (`dev`, `preprod`, or `prod`). |
| `COMMIT_HASH` | Git SHA to checkout and deploy. |

## Required secrets

| Secret | Description |
|---|---|
| `AWS_GITHUBRUNNER_PAT` | PAT for the self-hosted runner infrastructure. |
| `AWS_REGION` | AWS region for authentication and S3/CloudFront operations. |
| `AWS_ACCOUNT_ID` | AWS account ID for authentication. |
| `SLACK_WEBHOOK_URL` | Webhook URL for deployment notifications. |

## Environment-specific secrets (important)

The workflow resolves the S3 bucket and CloudFront distribution dynamically based on the `ENVIRONMENT` value. For each environment you deploy to, you **must** set the corresponding pair of secrets:

| Environment | Bucket secret | CloudFront secret |
|---|---|---|
| `dev` | `STATIC_SITE_DEV_DESTINATION_BUCKET` | `STATIC_SITE_DEV_CLOUDFRONT_DISTRIBUTION_ID` |
| `preprod` | `STATIC_SITE_PREPROD_DESTINATION_BUCKET` | `STATIC_SITE_PREPROD_CLOUDFRONT_DISTRIBUTION_ID` |
| `prod` | `STATIC_SITE_PROD_DESTINATION_BUCKET` | `STATIC_SITE_PROD_CLOUDFRONT_DISTRIBUTION_ID` |

These are marked as `required: false` in the workflow definition, but the **build will fail** at the "Validate environment-specific secrets" step if the pair for the target environment is missing.

## Optional inputs and defaults

| Input | Default | Notes |
|---|---|---|
| `SITE_PREFIX` | Calling repository name | S3 key prefix. Must match the key in `core-static-site` `sites.yaml`. |
| `NODE_VERSION` | `latest` | **Recommend pinning to an LTS version** (e.g. `22`) to avoid unexpected breakages. |
| `INSTALL_COMMAND` | `cd frontend && npm install` | Override if your project structure differs. |
| `BUILD_COMMAND` | `cd frontend && npm run build` | Override if your project structure differs. |
| `BUILD_DIRECTORY` | `frontend/dist` | Path to the build output. If you change `BUILD_COMMAND`, you likely need to change this too. |
| `EC2_INSTANCE_TYPE` | `t3.large` | Self-hosted runner instance type. `t3.medium` is fine for smaller sites. |
| `RUNNER_SIZE` | `large` | Runner disk/resource size. |
| `SITE_URL` | _(none)_ | If provided, enables the smoke test job. |
| `SMOKE_TEST_WAIT_SECONDS` | `30` | Seconds to wait for CloudFront propagation before the smoke test. |

## Optional secrets

| Secret | Description |
|---|---|
| `BUILD_ENV_VARS` | Newline-separated `KEY=VALUE` pairs written to a `.env` file before the build step. Use this for build-time configuration (e.g. API URLs). |

## What each job does

| Job | Behaviour |
|---|---|
| **start-runner** | Provisions a self-hosted EC2 runner. Blocking. |
| **build-and-deploy** | Checks out code, installs dependencies, builds the site, syncs to S3 with `--delete`, and invalidates CloudFront. **Blocking.** Note: S3 sync uses `--delete`, so files in the S3 prefix that are not in the build output will be removed. |
| **smoke-test** | Runs only when `SITE_URL` is provided. Curls the URL and expects HTTP 200. A **failed** smoke test marks the workflow as failed. A **skipped** smoke test (no `SITE_URL`) does not. |
| **notify-slack** | Always runs. Sends a success or failure message to the configured Slack webhook. |
| **stop-runner** | Tears down the self-hosted runner. Always runs. |
