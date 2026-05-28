import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateModuleConfigurations } from '../generator.js';

function tmpManifest(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modular-release-gen-'));
  const filePath = path.join(dir, 'modules.yml');
  fs.writeFileSync(filePath, contents);
  return { dir, filePath };
}

describe('generator', () => {
  test('writes one release.<module>.js per declared module', () => {
    const { dir, filePath } = tmpManifest(
      'modules:\n  packages:\n    - auth\n    - llm\n',
    );
    const outputDir = path.join(dir, 'out');
    fs.mkdirSync(outputDir);

    const templatePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '..',
      'templates',
      'release.template.js',
    );

    const generated = generateModuleConfigurations({
      manifestPath: filePath,
      templatePath,
      outputDirectory: outputDir,
      language: 'node',
      repoUrl: 'https://github.com/i-dot-ai/i-dot-ai-utilities-npm',
    });

    expect(generated).toHaveLength(2);
    expect(fs.existsSync(path.join(outputDir, 'release.auth.js'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'release.llm.js'))).toBe(true);

    const authConfig = fs.readFileSync(
      path.join(outputDir, 'release.auth.js'),
      'utf-8',
    );
    expect(authConfig).toContain("tagFormat: 'v${version}-auth'");
    expect(authConfig).toContain("pkgRoot: 'packages/auth'");
  });

  test('throws on an unsupported language', () => {
    const { filePath } = tmpManifest('modules:\n  packages:\n    - auth\n');
    expect(() =>
      generateModuleConfigurations({
        manifestPath: filePath,
        templatePath: '',
        outputDirectory: '',
        language: 'rust',
        repoUrl: 'https://example',
      }),
    ).toThrow(/Unsupported language/);
  });
});
