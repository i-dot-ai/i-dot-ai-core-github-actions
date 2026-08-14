# Configuration templates

## Release config

Used by the codegen at release time. Each generated configuration considers only commits whose conventional-commit scope exactly matches the module name. This prevents a commit for one module from releasing another module in the same repository.

Tags use `v<version>-<module>`. The composite action relies on this invariant when reporting the version and tag in its outputs.

The release rules are deliberately broader than the conventional-commits defaults: `refactor`, `chore`, and `style` each cut a patch release, on the basis that any scoped change to a published module is worth shipping. Semantic-release's own `chore(release):` commits are exempt because their scope is `release` rather than a module name.

Substituted variables:

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

## Commitlint config

Unlike the release config, `commitlint.template.js` is not processed by the codegen: consumers copy it into their repository as-is, and it has no substitution markers. The file documents its own scope-derivation contract.
