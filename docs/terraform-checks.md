# Terraform Checks

Reusable workflow that runs three static analysis checks on your Terraform code: format, lint, and security scan. No AWS credentials or secrets are required -- all jobs run on `ubuntu-latest` public runners.

## Usage

```yaml
jobs:
  terraform-checks:
    uses: i-dot-ai/i-dot-ai-core-github-actions/.github/workflows/terraform-checks.yml@main
    # with:
    #   TERRAFORM_DIRECTORY: "infrastructure"
    #   TF_FILE: "infrastructure/provider.tf"
    #   CHECKOV_SOFT_FAIL: true
```

No secrets need to be passed.

## Inputs and defaults

All inputs are optional. The defaults assume your Terraform lives in `terraform/` with a version constraint in `terraform/provider.tf`.

| Input | Default | Notes |
|---|---|---|
| `TERRAFORM_DIRECTORY` | `terraform` | Root directory containing your `.tf` files. |
| `TF_FILE` | `terraform/provider.tf` | File containing the `required_version` constraint. The workflow parses this to determine which Terraform version to install. |
| `TFLINT_VERSION` | `latest` | TFLint version to install. |
| `TFLINT_CONTINUE_ON_ERROR` | `false` | Set to `true` to make the lint job non-blocking (see below). |
| `CHECKOV_SOFT_FAIL` | `false` | Set to `true` to make the security scan non-blocking (see below). |
| `CHECKOV_DOWNLOAD_EXTERNAL_MODULES` | `true` | Whether Checkov pulls public modules from git/registry to scan them. Set to `false` if you only use private/internal modules. |

## Prerequisites

- Your Terraform directory must contain a file (default `terraform/provider.tf`) with a `required_version` constraint. The workflow uses this to auto-detect and install the correct Terraform version.
- If you use TFLint plugins, ensure a `.tflint.hcl` config exists in your Terraform directory -- the workflow runs `tflint --init` which reads this file.

## Blocking vs. non-blocking jobs

| Job | Default behaviour | How to make non-blocking |
|---|---|---|
| **Terraform Format Check** | **Blocking.** No override available. | Fix locally with `terraform fmt -recursive terraform/`. |
| **Terraform Lint (TFLint)** | **Blocking.** | Set `TFLINT_CONTINUE_ON_ERROR: true`. |
| **Terraform Security Scan (Checkov)** | **Blocking.** | Set `CHECKOV_SOFT_FAIL: true`. Recommended when first adopting the workflow -- review findings and tighten once triaged. |

All three jobs run in parallel (format and lint both depend on the version-detection step; Checkov has no dependencies).
