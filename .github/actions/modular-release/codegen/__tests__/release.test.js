import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { buildReleaseConfig } from '../release.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, '..', 'templates', 'release.template.js');
const templateContents = fs.readFileSync(templatePath, 'utf-8');

function generate(language, opts = {}) {
  return buildReleaseConfig(
    'auth',
    'packages',
    language,
    templateContents,
    {
      repoUrl: 'https://github.com/i-dot-ai/i-dot-ai-utilities-npm',
      ...opts,
    },
  );
}

function writeAndCheck(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-config-'));
  // Write as .mjs so `node --check` parses it as an ES module.
  const file = path.join(dir, 'release.auth.mjs');
  fs.writeFileSync(file, contents);
  execSync(`node --check "${file}"`, { stdio: 'pipe' });
  return file;
}

describe('release.template substitution', () => {
  test('produces a syntactically valid module for node', () => {
    const generated = generate('node');
    writeAndCheck(generated);
    expect(generated).toContain("tagFormat: 'v${version}-auth'");
    expect(generated).toContain('@semantic-release/npm');
    expect(generated).toContain("pkgRoot: 'packages/auth'");
    expect(generated).not.toContain('uv lock');
  });

  test('omits the npm plugin for python and includes the uv lock prepare step', () => {
    const generated = generate('python');
    writeAndCheck(generated);
    expect(generated).not.toContain('@semantic-release/npm');
    expect(generated).toContain(
      'cd packages/auth && uv lock --upgrade-package i-dot-ai-utilities-auth',
    );
    expect(generated).toContain('packages/auth/pyproject.toml');
    expect(generated).toContain('packages/auth/uv.lock');
  });

  test('omits both npm and prepare for terraform', () => {
    const generated = generate('terraform');
    writeAndCheck(generated);
    expect(generated).not.toContain('@semantic-release/npm');
    expect(generated).not.toContain('@semantic-release/exec');
  });

  test('rejects an unsupported language', () => {
    expect(() => generate('rust')).toThrow(/Unsupported language/);
  });

  test('rejects missing required release options', () => {
    expect(() =>
      buildReleaseConfig('auth', 'packages', 'node', templateContents),
    ).toThrow(/repoUrl is required/);
    expect(() =>
      buildReleaseConfig('auth', 'packages', '', templateContents, {
        repoUrl: 'https://example',
      }),
    ).toThrow(/language is required/);
  });

  test('uses packagesDir instead of the manifest directory when provided', () => {
    const generated = generate('node', { packagesDir: 'components' });
    expect(generated).toContain("pkgRoot: 'components/auth'");
    expect(generated).toContain('components/auth/CHANGELOG.md');
  });

  test('places a module under its nested package directory', () => {
    const generated = buildReleaseConfig(
      'vpc',
      'infrastructure/networking',
      'terraform',
      templateContents,
      { repoUrl: 'https://example' },
    );
    expect(generated).toContain('infrastructure/networking/vpc/CHANGELOG.md');
  });

  test('uses the consumer repo URL in the generated config', () => {
    const generated = generate('node');
    expect(generated).toContain(
      "repositoryUrl: 'https://github.com/i-dot-ai/i-dot-ai-utilities-npm'",
    );
  });

  test('scopes release rules to the module name', () => {
    const generated = generate('node');
    expect(generated).toContain("scope: 'auth'");
    expect(generated).toContain("scope: '!auth', release: false");
  });

  test('defaults branches to main only', () => {
    const generated = generate('node');
    expect(generated).toContain("branches: ['main'],");
    expect(generated).not.toContain('prerelease');
  });

  test('adds a prerelease channel when preReleaseBranch is set', () => {
    const generated = generate('node', { preReleaseBranch: 'release/next' });
    expect(generated).toContain(
      'branches: ["main",{"name":"release/next","prerelease":true}],',
    );
  });
});
