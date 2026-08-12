#!/usr/bin/env node
// Generates module configurations for the composite action.
//
// Usage:
//   node codegen/cli.js \
//     --manifest <path> \
//     --template <path> \
//     --output <dir> \
//     --language <node|python|terraform> \
//     --repo-url <https://github.com/...> \
//     [--packages-dir <dir>] \
//     [--pre-release-branch <branch-name>]
//
// Generated files are written below --output. On success, stdout contains the
// generated module list as JSON. Argument errors exit with status 2; manifest,
// validation, and filesystem errors exit with status 1.

import { generateModuleConfigurations } from './generator.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag || !flag.startsWith('--')) {
      throw new Error(`Unexpected argument: ${flag}`);
    }
    args[flag.slice(2)] = value;
  }
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const required = ['manifest', 'template', 'output', 'language', 'repo-url'];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Missing required argument --${key}`);
      process.exit(2);
    }
  }

  const generated = generateModuleConfigurations({
    manifestPath: args['manifest'],
    templatePath: args['template'],
    outputDirectory: args['output'],
    language: args['language'],
    repoUrl: args['repo-url'],
    packagesDir: args['packages-dir'],
    preReleaseBranch: args['pre-release-branch'],
  });

  process.stdout.write(JSON.stringify(generated, null, 2));
}

main();
