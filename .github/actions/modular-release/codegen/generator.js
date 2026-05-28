import getAndValidateModules from './modules.js';
import { upsertReleaseConfig } from './release.js';
import { supportedLanguages } from './constants.js';

// Programmatic entrypoint. The composite action invokes this with explicit
// arguments rather than relying on relative paths from a working directory.
//
// Args:
//   manifestPath:    path to the consumer's modules.yml
//   templatePath:    path to the release.template.js shipped inside the action
//   outputDirectory: directory to write release.<module>.js files into
//                    (typically a runner temp dir, never the consumer repo)
//   language:        'node' | 'python' | 'terraform'
//   repoUrl:         consumer repo URL (https://github.com/<owner>/<repo>)
//   packagesDir:     optional override for the package group directory
//
// Returns the list of `{ name, parentKeys, configPath }` for downstream
// dispatch.
export function generateModuleConfigurations({
  manifestPath,
  templatePath,
  outputDirectory,
  language,
  repoUrl,
  packagesDir,
}) {
  if (!supportedLanguages.includes(language)) {
    throw new Error(
      `Unsupported language '${language}'. Must be one of: ${supportedLanguages.join(', ')}`,
    );
  }

  const moduleInfo = getAndValidateModules(manifestPath);
  const generated = [];

  for (const key of moduleInfo) {
    const configPath = upsertReleaseConfig(
      key.name,
      key.parentKeys,
      language,
      templatePath,
      outputDirectory,
      { repoUrl, packagesDir },
    );
    generated.push({ name: key.name, parentKeys: key.parentKeys, configPath });
  }

  return generated;
}

export default generateModuleConfigurations;
