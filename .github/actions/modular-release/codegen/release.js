import * as path from 'path';
import { readFileContents, replaceTemplateVariables, writeConfig } from './utils.js';

function buildLanguageFragments(language, packagePath) {
  switch (language) {
    case 'node':
      return {
        npmPlugin: `[
      '@semantic-release/npm',
      {
        npmPublish: true,
        pkgRoot: '${packagePath}',
      },
    ],`,
        prepareExec: '',
        gitAssets: JSON.stringify([
          `${packagePath}/CHANGELOG.md`,
          `${packagePath}/package.json`,
        ]),
      };
    case 'python':
      // The prepareCmd contains literal `${MODULE_NAME}` etc. — those are
      // substituted into the generated config later by replaceTemplateVariables.
      // We use string concatenation here so the JS template literal does not
      // interpolate them at fragment-build time.
      return {
        npmPlugin: '',
        prepareExec:
          "[\n" +
          "      '@semantic-release/exec',\n" +
          "      {\n" +
          "        prepareCmd: 'cd ${PACKAGE_PATH} && uv lock --upgrade-package i-dot-ai-utilities-${MODULE_NAME}',\n" +
          "      },\n" +
          "    ],",
        gitAssets: JSON.stringify([
          `${packagePath}/CHANGELOG.md`,
          `${packagePath}/pyproject.toml`,
          `${packagePath}/uv.lock`,
        ]),
      };
    case 'terraform':
      return {
        npmPlugin: '',
        prepareExec: '',
        gitAssets: JSON.stringify([`${packagePath}/CHANGELOG.md`]),
      };
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

function buildPackagePath(packageDir, moduleName, packagesDirOverride) {
  return path.posix.join(packagesDirOverride || packageDir, moduleName);
}

/**
 * Produces a semantic-release configuration for one module.
 *
 * @param {string} moduleName Manifest name used as the commit scope and tag suffix.
 * @param {string} packageDir Module group's directory as a POSIX-relative path.
 * @param {'node'|'python'|'terraform'} language Consumer ecosystem.
 * @param {string} templateContents Release template source.
 * @param {object} options
 * @param {string} options.repoUrl Consumer repository URL; required.
 * @param {string} [options.packagesDir] Directory containing all modules. When
 * omitted, `packageDir` locates the module.
 * @param {string} [options.preReleaseBranch] Prerelease channel. When omitted,
 * only production releases from `main` are enabled.
 * @returns {string} Complete JavaScript configuration source.
 * @throws {Error} If `repoUrl` or `language` is missing or unsupported.
 */
export function buildReleaseConfig(
  moduleName,
  packageDir,
  language,
  templateContents,
  options = {},
) {
  const { repoUrl, packagesDir, preReleaseBranch } = options;

  if (!repoUrl) throw new Error('repoUrl is required');
  if (!language) throw new Error('language is required');

  const packagePath = buildPackagePath(packageDir, moduleName, packagesDir);
  const fragments = buildLanguageFragments(language, packagePath);

  // Retaining main alongside an optional prerelease channel ensures the same
  // generated config can promote production releases without changing policy.
  let branchesValue;
  if (preReleaseBranch) {
    branchesValue = JSON.stringify([
      'main',
      { name: preReleaseBranch, prerelease: true },
    ]);
  } else {
    branchesValue = "['main']";
  }

  let prepared = templateContents;
  prepared = replaceTemplateVariables('${BRANCHES}', branchesValue, prepared);
  prepared = replaceTemplateVariables('${NPM_PLUGIN}', fragments.npmPlugin, prepared);
  prepared = replaceTemplateVariables('${PREPARE_EXEC}', fragments.prepareExec, prepared);
  prepared = replaceTemplateVariables('${GIT_ASSETS}', fragments.gitAssets, prepared);
  prepared = replaceTemplateVariables('${MODULE_NAME}', moduleName, prepared);
  prepared = replaceTemplateVariables('${REPO_URL}', repoUrl, prepared);
  prepared = replaceTemplateVariables('${PACKAGE_PATH}', packagePath, prepared);
  prepared = replaceTemplateVariables(
    '${CHANGELOG_PATH}',
    `${packagePath}/CHANGELOG.md`,
    prepared,
  );

  return prepared;
}

/**
 * Writes a generated module configuration to `outputDirectory`.
 *
 * Parent directories are created synchronously when absent. Existing module
 * configuration files are replaced.
 *
 * @param {string} moduleName Manifest module name.
 * @param {string} packageDir Module group's directory as a POSIX-relative path.
 * @param {'node'|'python'|'terraform'} language Consumer ecosystem.
 * @param {string} templatePath Path to the release template.
 * @param {string} outputDirectory Directory that receives the generated file.
 * @param {object} options Options accepted by {@link buildReleaseConfig}.
 * @returns {string} Path to `release.<moduleName>.js`.
 * @throws {Error} If template reading, validation, or file writing fails.
 */
export function upsertReleaseConfig(
  moduleName,
  packageDir,
  language,
  templatePath,
  outputDirectory,
  options = {},
) {
  const templateContents = readFileContents(templatePath);
  const prepared = buildReleaseConfig(
    moduleName,
    packageDir,
    language,
    templateContents,
    options,
  );
  const outputPath = `${outputDirectory}/release.${moduleName}.js`;
  writeConfig(outputPath, prepared);
  return outputPath;
}

export default upsertReleaseConfig;
