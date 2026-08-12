# Release config template

Used by the codegen at CI time. Substituted variables:

| Variable | Description |
|---|---|
| `${BRANCHES}` | semantic-release `branches` value: `['main']`, or `['main', { name: '<pre-release-branch>', prerelease: true }]` when a pre-release branch is configured |
| `${MODULE_NAME}` | Module's manifest name (also the conventional-commit scope) |
| `${REPO_URL}` | Consumer repo URL (`https://github.com/<owner>/<repo>`) |
| `${PACKAGE_PATH}` | Relative path to the module's package directory (e.g. `packages/auth`) |
| `${CHANGELOG_PATH}` | Path to the per-module CHANGELOG.md |
| `${NPM_PLUGIN}` | The `@semantic-release/npm` plugin entry, or empty string for non-Node languages |
| `${PREPARE_EXEC}` | A `@semantic-release/exec` entry that runs language-specific pre-release commands (e.g. `uv lock` for Python), or empty string |
| `${GIT_ASSETS}` | JSON array of file paths for `@semantic-release/git` to commit alongside the CHANGELOG |

The generated `release.<module>.js` is written to a runner temp directory and never committed to the consumer repository.
