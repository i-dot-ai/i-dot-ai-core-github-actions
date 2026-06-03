import { readFileContents, replaceTemplateVariables, writeConfig } from './utils.js';

// The commitlint config in the consumer repo is a checked-in file rather than
// a generated one (see RFC, Section 'Per-repository surface'). This generator
// is exposed for parity with the Terraform-modules pattern and for use by a
// local `make configure-modules` target if a consumer wants one.
export function buildCommitlintConfig(moduleList, templateContents) {
  const modulesFormatted = moduleList.map((item) => `'${item}'`).join(',\n  ');
  return replaceTemplateVariables("'${MODULES}'", modulesFormatted, templateContents);
}

export function upsertCommitlintConfig(moduleList, templatePath, outputPath) {
  const templateContents = readFileContents(templatePath);
  const prepared = buildCommitlintConfig(moduleList, templateContents);
  writeConfig(outputPath, prepared);
  return outputPath;
}

export default upsertCommitlintConfig;
