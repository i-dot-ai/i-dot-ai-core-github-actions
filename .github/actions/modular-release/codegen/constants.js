// Default paths used when running the codegen from inside the composite action.
// Consumers do not import these directly; the composite action passes explicit
// paths from its inputs.
export const defaultReleaseTemplatePath =
  './codegen/templates/release.template.js';
export const defaultCommitlintTemplatePath =
  './codegen/templates/commitlint.template.js';

export const supportedLanguages = ['python', 'node', 'terraform'];
