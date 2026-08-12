// Reference commitlint configuration for modular-release consumers.
//
// Copy this file to the root of a consumer repository as `commitlint.config.js`.
// It derives the permitted module scopes from `modules.yml` at load time, so the
// scope-enum can never drift from the canonical module set. Do NOT hard-code
// module names here — edit `modules.yml` and this config follows automatically.
//
// `modules.yml` has a shallow shape:
//   modules:
//     <group>:
//       - <module-name>
//       - <module-name>
// Every list-item leaf is a module name (and a permitted conventional-commit
// scope). We collect them with a small dependency-free scan rather than a YAML
// library: this avoids a dependency that would not resolve reliably under a
// `node-linker=isolated` setting, and it works for both flat manifests and the
// nested manifests used by other module-library repositories.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readModuleScopes() {
  const manifestPath = fileURLToPath(new URL('./modules.yml', import.meta.url));
  const raw = readFileSync(manifestPath, 'utf8');

  const names = [];
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    if (match) {
      names.push(match[1].replace(/['"]/g, ''));
    }
  }
  return names;
}

// Repository-wide scopes that never produce a release. `release` is intentionally
// omitted: semantic-release commits (`chore(release): ... [skip ci]`) land on main
// directly and are never linted, because commitlint runs only on pull-request
// commits.
const noReleaseScopes = ['config', 'ci', 'misc', 'tests'];

const Configuration = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [...readModuleScopes(), ...noReleaseScopes]],
    'scope-empty': [2, 'never'],
  },
  defaultIgnores: true,
};

export default Configuration;
