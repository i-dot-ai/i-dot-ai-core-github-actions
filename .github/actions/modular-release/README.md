# i-dot-ai-core-github-actions

Core GitHub Actions and reusable workflows for i-dot-ai projects.

## modular-release

Per-module release dispatch for module-library repositories (`i-dot-ai-utilities`, `i-dot-ai-utilities-npm`, `i-dot-ai-core-terraform-modules`).

The action reads a `modules.yml` manifest, detects which modules changed in the merged commit, generates a per-module `semantic-release` configuration at CI time, and dispatches `semantic-release` once per changed module. Supports `node`, `python`, and `terraform` consumers.

### Consumption

Pin the **workflow** (or composite action) ref to a commit SHA or SemVer tag when available. Prefer a SHA over `@main` so release behaviour does not change under you without an explicit bump. The reusable workflow resolves the composite action via a same-repo relative path (`./.github/actions/modular-release`), so pinning the workflow ref also pins the action commit.

Reusable workflow (recommended interface):

```yaml
jobs:
  release:
    # Prefer a commit SHA or SemVer tag once published, e.g. @v1 or @<sha>
    uses: i-dot-ai/i-dot-ai-core-github-actions/.github/workflows/modular-release.yml@main
    with:
      modules-manifest: modules.yml
      language: node
      packages-dir: packages
    secrets:
      registry-token: ${{ secrets.NPM_TOKEN }}
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

Composite action (if a consumer needs full control of the surrounding job):

```yaml
# Prefer a commit SHA or SemVer tag once published, e.g. @v1 or @<sha>
- uses: i-dot-ai/i-dot-ai-core-github-actions/.github/actions/modular-release@main
  with:
    modules-manifest: modules.yml
    language: node
    packages-dir: packages
    registry-token: ${{ secrets.NPM_TOKEN }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input | Required | Notes |
|---|---|---|
| `modules-manifest` | yes | Path to `modules.yml` (defaults to `modules.yml`) |
| `language` | yes | `python`, `node`, or `terraform` |
| `packages-dir` | no | Override directory containing per-module packages. Required when modules are flat under one directory rather than organised by manifest group |
| `working-directory` | no | Directory to run commands in (default repo root) |
| `node-version` | no | Default `22` |
| `pnpm-version` | no | Default `9` (Node only) |
| `python-version` | no | Default `3.12` (Python only) |
| `repo-url` | no | Defaults to the calling repository |
| `registry-token` | secret | NPM_TOKEN, PYPI_TOKEN, or empty for Terraform |
| `github-token` | secret | `contents:write` to push the release commit and tag |

### Canonical toolchain versions

These are the single-source-of-truth default toolchain versions for all consumers of `modular-release`. Consumers should rely on these defaults (or pass matching values explicitly) so the release environment stays consistent across repositories.

| Toolchain | Version | Notes |
|---|---|---|
| Node.js | `22` | Oldest still-supported LTS; used for the `semantic-release` runtime and Node builds. Matches consumer CI. |
| pnpm | `9` | Node consumers only. |
| Python | `3.12` | Python consumers only (default; Python repos test the `3.10`–`3.13` range). |
| `engines.node` (published Node packages) | `>=22.0.0` | Compatibility floor for published packages. Node 18 and 20 are end-of-life. |

Changing any of these defaults is a behaviour change for consumers pinned to a mutable ref, and should ship with a new SemVer tag of this repository so consumers adopt it explicitly.

### Outputs

- `released-modules` — JSON array of `{ module, version, tag }` objects.
- `failed-modules` — JSON array of `{ module, error }` objects.

### Tests

```
cd .github/actions/modular-release/codegen
npm install
npm test
```

CI runs the unit tests plus a fixture codegen for all three languages on every PR that touches the action.
