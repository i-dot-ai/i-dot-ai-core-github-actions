#!/usr/bin/env node
/**
 * Lists manifest modules for shell-based change detection.
 *
 * Usage: `node codegen/list-modules.js <manifest-path>`
 *
 * Writes one tab-separated `<group-directory>\t<module-name>` record per line.
 * The group directory comes from the manifest key path; callers join it with
 * the module name unless they override it with a packages directory.
 *
 * Exits with status 2 when the manifest argument is missing and status 1 when
 * reading or validating the manifest fails.
 */

import getAndValidateModules from './modules.js';

const [manifestPath] = process.argv.slice(2);

if (!manifestPath) {
  console.error('Usage: list-modules.js <manifest-path>');
  process.exit(2);
}

try {
  const modules = getAndValidateModules(manifestPath);
  const records = modules.map(
    ({ name, packageDir }) => `${packageDir}\t${name}`,
  );

  if (records.length > 0) {
    process.stdout.write(`${records.join('\n')}\n`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
