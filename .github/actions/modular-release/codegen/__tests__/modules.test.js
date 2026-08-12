import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import getAndValidateModules from '../modules.js';

function tmpFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modular-release-'));
  const filePath = path.join(dir, 'modules.yml');
  fs.writeFileSync(filePath, contents);
  return filePath;
}

describe('modules manifest parser', () => {
  test('walks a flat single-group manifest', () => {
    const manifest = tmpFile(`modules:\n  packages:\n    - auth\n    - llm\n`);
    const result = getAndValidateModules(manifest);
    expect(result).toEqual([
      { name: 'auth', packageDir: 'packages' },
      { name: 'llm', packageDir: 'packages' },
    ]);
  });

  test('walks a nested multi-group manifest like the terraform repo', () => {
    const manifest = tmpFile(`
modules:
  infrastructure:
    - rds
    - vpc
  observability:
    - cost
`);
    const result = getAndValidateModules(manifest);
    expect(result).toEqual([
      { name: 'rds', packageDir: 'infrastructure' },
      { name: 'vpc', packageDir: 'infrastructure' },
      { name: 'cost', packageDir: 'observability' },
    ]);
  });

  test('joins deeply nested manifest keys into a slash-separated directory', () => {
    const manifest = tmpFile(`
modules:
  infrastructure:
    networking:
      - vpc
`);
    const result = getAndValidateModules(manifest);
    expect(result).toEqual([
      { name: 'vpc', packageDir: 'infrastructure/networking' },
    ]);
  });

  test('rejects duplicate module names across groups', () => {
    const manifest = tmpFile(`
modules:
  infrastructure:
    - shared
  observability:
    - shared
`);
    expect(() => getAndValidateModules(manifest)).toThrow(/duplicate names/);
  });

  test('tolerates a manifest without the top-level modules key', () => {
    const manifest = tmpFile(`packages:\n  - auth\n`);
    const result = getAndValidateModules(manifest);
    expect(result).toEqual([{ name: 'auth', packageDir: 'packages' }]);
  });
});
