import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, '.tmp-changed-modules');
const detectorPath = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'get_changed_modules.sh',
);

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf-8' });
}

function git(cwd, ...args) {
  const result = run('git', args, cwd);
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
}

function commit(cwd, message) {
  git(cwd, 'add', '.');
  git(
    cwd,
    '-c',
    'user.name=Modular Release Tests',
    '-c',
    'user.email=modular-release@example.test',
    'commit',
    '-m',
    message,
  );
}

function createRepository() {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(fixtureRoot, 'repository-'));
  fs.mkdirSync(path.join(directory, 'packages', 'auth', 'tests'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(directory, 'modules.yml'),
    'modules:\n  packages:\n    - auth\n',
  );
  fs.writeFileSync(
    path.join(directory, 'packages', 'auth', 'index.js'),
    'export const version = 1;\n',
  );
  fs.writeFileSync(
    path.join(directory, 'packages', 'auth', 'tests', 'auth.test.js'),
    'test("auth", () => {});\n',
  );
  git(directory, 'init');
  commit(directory, 'initial fixture');
  return directory;
}

function detect(cwd, manifest = 'modules.yml', packagesDirectory = 'packages') {
  return run('bash', [detectorPath, manifest, packagesDirectory], cwd);
}

describe('changed module detection', () => {
  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('fails when the manifest does not exist', () => {
    const directory = createRepository();
    const result = detect(directory, 'missing.yml');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Manifest not found');
  });

  // createRepository leaves the fixture on its first commit, so HEAD has no
  // parent to diff against.
  test('fails when the first parent is unavailable', () => {
    const directory = createRepository();
    const result = detect(directory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Cannot diff HEAD against its first parent');
  });

  test('fails when the manifest cannot be parsed', () => {
    const directory = createRepository();
    fs.writeFileSync(path.join(directory, 'modules.yml'), 'modules: [\n');
    commit(directory, 'invalid manifest');

    const result = detect(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('flow collection');
  });

  test('returns no modules for changes outside package directories', () => {
    const directory = createRepository();
    fs.writeFileSync(path.join(directory, 'README.md'), 'repository docs\n');
    commit(directory, 'docs change');

    const result = detect(directory);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('returns a module with changed release content', () => {
    const directory = createRepository();
    fs.writeFileSync(
      path.join(directory, 'packages', 'auth', 'index.js'),
      'export const version = 2;\n',
    );
    commit(directory, 'source change');

    const result = detect(directory);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('auth');
  });

  test('ignores test-only module changes', () => {
    const directory = createRepository();
    fs.writeFileSync(
      path.join(directory, 'packages', 'auth', 'tests', 'auth.test.js'),
      'test("auth changed", () => {});\n',
    );
    commit(directory, 'test change');

    const result = detect(directory);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('uses nested manifest keys as the package directory', () => {
    const directory = createRepository();
    fs.writeFileSync(
      path.join(directory, 'modules.yml'),
      'modules:\n  infrastructure:\n    networking:\n      - vpc\n',
    );
    fs.mkdirSync(
      path.join(directory, 'infrastructure', 'networking', 'vpc'),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(directory, 'infrastructure', 'networking', 'vpc', 'main.tf'),
      'resource "example" "vpc" {}\n',
    );
    commit(directory, 'replace fixture with nested module');
    fs.appendFileSync(
      path.join(directory, 'infrastructure', 'networking', 'vpc', 'main.tf'),
      '# changed\n',
    );
    commit(directory, 'nested source change');

    const result = detect(directory, 'modules.yml', '');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('vpc');
  });
});
