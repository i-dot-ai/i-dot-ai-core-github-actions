import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const actionDirectory = path.join(__dirname, '..', '..');
const githubDirectory = path.join(actionDirectory, '..', '..');

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf-8'));
}

describe('documented action contract', () => {
  const action = readYaml(path.join(actionDirectory, 'action.yml'));
  const workflow = readYaml(
    path.join(githubDirectory, 'workflows', 'modular-release.yml'),
  );
  const testWorkflow = readYaml(
    path.join(githubDirectory, 'workflows', '_test-modular-release.yml'),
  );
  const readme = fs.readFileSync(
    path.join(actionDirectory, 'README.md'),
    'utf-8',
  );

  test('uses the documented Node default in every release workflow', () => {
    const documentedVersion = '22';
    const setupVersions = Object.values(testWorkflow.jobs).flatMap((job) =>
      job.steps
        .filter((step) => step.uses?.startsWith('actions/setup-node@'))
        .map((step) => step.with['node-version']),
    );

    expect(action.inputs['node-version'].default).toBe(documentedVersion);
    expect(
      workflow.on.workflow_call.inputs['node-version'].default,
    ).toBe(documentedVersion);
    expect(setupVersions).not.toHaveLength(0);
    expect(setupVersions.every((version) => version === documentedVersion)).toBe(
      true,
    );
    expect(readme).toContain(`| Node.js | \`${documentedVersion}\` |`);
  });

  test('lists every composite action input in the README', () => {
    for (const input of Object.keys(action.inputs)) {
      expect(readme).toContain(`| \`${input}\``);
    }
  });

  // Only the dispatch step is checkable: the other run blocks embed ${{ }}
  // expressions that bash cannot parse.
  test('keeps the release dispatch shell syntactically valid', () => {
    const dispatch = action.runs.steps.find((step) => step.id === 'dispatch');
    const result = spawnSync('bash', ['-n'], {
      input: dispatch.run,
      encoding: 'utf-8',
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
