import getAndValidateModules from './modules.js';
import { upsertReleaseConfig } from './release.js';
import { supportedLanguages } from './constants.js';

/**
 * Generates one semantic-release configuration for every declared module.
 *
 * Files are written synchronously to `outputDirectory`; callers should use a
 * temporary directory because generated configs may contain repository-specific
 * values.
 *
 * @param {object} options
 * @param {string} options.manifestPath Path to the consumer's modules manifest.
 * @param {string} options.templatePath Path to the release config template.
 * @param {string} options.outputDirectory Directory that receives generated configs.
 * @param {'node'|'python'|'terraform'} options.language Consumer ecosystem.
 * @param {string} options.repoUrl Consumer repository URL.
 * @param {string} [options.packagesDir] Directory that directly contains all modules.
 * @param {string} [options.preReleaseBranch] Branch exposed as a prerelease channel.
 * @returns {{name: string, packageDir: string, configPath: string}[]} Generated modules.
 * @throws {Error} If the language, manifest, template, or output path is invalid.
 */
export function generateModuleConfigurations({
  manifestPath,
  templatePath,
  outputDirectory,
  language,
  repoUrl,
  packagesDir,
  preReleaseBranch,
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
      key.packageDir,
      language,
      templatePath,
      outputDirectory,
      { repoUrl, packagesDir, preReleaseBranch },
    );
    generated.push({ name: key.name, packageDir: key.packageDir, configPath });
  }

  return generated;
}

export default generateModuleConfigurations;
