# i-dot-ai-core-github-actions

Core GitHub Actions and reusable workflows for i-dot-ai projects.

## modular-release

Per-module release dispatch for module-library repositories (`i-dot-ai-utilities`, `i-dot-ai-utilities-npm`, `i-dot-ai-core-terraform-modules`).

The action reads a `modules.yml` manifest, detects which modules changed in the merged commit, generates a per-module `semantic-release` configuration at CI time, and dispatches `semantic-release` once per changed module. Supports `node`, `python`, and `terraform` consumers.

### Consumption

Reusable workflow (recommended interface):

```yaml
jobs:
  release:
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
| `node-version` | no | Default `20` |
| `pnpm-version` | no | Default `9` (Node only) |
| `python-version` | no | Default `3.12` (Python only) |
| `repo-url` | no | Defaults to the calling repository |
| `registry-token` | secret | NPM_TOKEN, PYPI_TOKEN, or empty for Terraform |
| `github-token` | secret | `contents:write` to push the release commit and tag |

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
