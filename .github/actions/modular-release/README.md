# i-dot-ai-core-github-actions

Core GitHub Actions and reusable workflows for i-dot-ai projects.

## modular-release

Per-module release dispatch for module-library repositories (`i-dot-ai-utilities`, `i-dot-ai-utilities-npm`, `i-dot-ai-core-terraform-modules`).

The action releases independently versioned modules from a shared repository. It limits each release to commits scoped to that module and supports `node`, `python`, and `terraform` consumers.

### Consumption

Pin the **workflow** (or composite action) ref to a commit SHA or SemVer tag when available. Prefer a SHA over `@main` so release behaviour does not change under you without an explicit bump. The reusable workflow resolves the composite action via a same-repo relative path (`./.github/actions/modular-release`), so pinning the workflow ref also pins the action commit.

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
| `modules-manifest` | no | Path to `modules.yml` (defaults to `modules.yml`) |
| `language` | yes | `python`, `node`, or `terraform` |
| `packages-dir` | no | Directory holding every module package. Set it when modules are flat under one directory rather than organised by manifest group |
| `working-directory` | no | Directory to run commands in (default repo root) |
| `node-version` | no | Default `22` |
| `pnpm-version` | no | Default `11` (Node only) |
| `python-version` | no | Default `3.12` (Python only) |
| `repo-url` | no | Defaults to the calling repository |
| `registry-token` | secret | npm or uv/PyPI publish token; empty for Terraform |
| `github-token` | secret | `contents:write` to push release commits and tags and create releases |
| `dry-run` | no | Evaluate releases without publishing, committing, or tagging; default `false`. The reusable workflow types this as a `boolean`; the composite action receives the stringified value and treats only the literal `true` as enabled |
| `pre-release-branch` | no | Optional branch exposed as a semantic-release prerelease channel |

### Release contract

The action compares `HEAD` with its first parent and releases modules with source changes under their package directory. A caller must check out at least two commits; the reusable workflow does this with `fetch-depth: 2`. The release policy treats changes whose path contains a `tests` or `__tests__` directory as test-only, so they do not trigger a new package version.

`modules.yml` may contain a top-level `modules` key or a bare mapping. Each list item is a module name. Mapping keys form its package path:

```yaml
modules:
  infrastructure:
    networking:
      - vpc
```

Without `packages-dir`, this module lives at `infrastructure/networking/vpc`. With `packages-dir: packages`, every module lives directly below `packages`, such as `packages/vpc`.

For each changed module, the action:

1. Generates a semantic-release configuration in the runner's temporary directory.
2. Runs an isolated package smoke test, for non-dry-run Node releases that set `packages-dir`.
3. Invokes semantic-release with commits filtered to that module's conventional-commit scope.
4. Publishes the package where applicable, updates its changelog and package metadata, creates a release commit and `v<version>-<module>` tag, and creates the GitHub release.

Semantic-release failures are collected so the remaining changed modules are still attempted, and the action exits non-zero after the loop. Setup and smoke-test failures stop the action immediately. A successful semantic-release run that produces no tag is treated as a no-op rather than a release. A module that leaves more than one matching tag at `HEAD` is reported in `failed-modules` with the error `multiple release tags found at HEAD`, because its released version is ambiguous.

The consumer repository must provide a root `package.json` containing semantic-release and the plugins referenced by the generated configuration. Node consumers must also provide a pnpm lockfile and workspace configuration. The registry token is passed under the npm and uv environment variable names expected by the supported publishers.

### Canonical toolchain versions

This section is the policy source for modular-release toolchain defaults. The action and the reusable workflow declare these versions as their input defaults, and `contract.test.js` enforces the Node row across the action, both workflows, and this table. Consumers should rely on the defaults or pass matching values explicitly so the release environment stays consistent across repositories.

| Toolchain | Version | Notes |
|---|---|---|
| Node.js | `22` | Oldest still-supported LTS; used for the `semantic-release` runtime and Node builds. Matches consumer CI. |
| pnpm | `11` | Node consumers only. |
| Python | `3.12` | Python consumers only (default; Python repos test the `3.10`–`3.13` range). |

Changing any of these defaults is a behaviour change for consumers pinned to a mutable ref, and should ship with a new SemVer tag of this repository so consumers adopt it explicitly.

Separately, published Node packages should declare `engines.node` of `>=22.0.0`, since Node 18 and 20 are end-of-life. This action does not set or verify that field.

### Commit scopes

Each module name is a permitted conventional-commit scope. Consumer repositories keep a `commitlint.config.js` checked in (so local development and pull-request checks do not depend on release-time code generation) that derives its permitted scopes from `modules.yml` at load time. Because the scope list is derived rather than hard-coded, it never drifts from the canonical module set. See [`codegen/templates/commitlint.template.js`](codegen/templates/commitlint.template.js) for the reference config to copy.

See [`codegen/templates/README.md`](codegen/templates/README.md) for the release and commitlint template contracts.

### Outputs

- `released-modules` — JSON array of `{ module, version, tag }` objects. Dry runs use `"dry-run"` for `version` and `tag`.
- `failed-modules` — JSON array of `{ module, error }` objects.

### Tests

```
cd .github/actions/modular-release/codegen
npm install
npm test
```

CI runs the unit tests plus a fixture codegen for all three languages on every PR that touches the action.
