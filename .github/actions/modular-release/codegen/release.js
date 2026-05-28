import * as path from 'path';
import { readFileContents, replaceTemplateVariables, writeConfig } from './utils.js';

// Language-conditional plugin fragments used by the release template.
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

function buildPackagePath(parentKeys, moduleName, packagesDir) {
  // parentKeys is e.g. "packages" or "infrastructure" or empty.
  // packagesDir overrides the leading directory for languages that store
  // packages somewhere other than the manifest's group key (rare, but supported).
  const groupDir = packagesDir || parentKeys.replace(/\./g, '/');
  return path.posix.join(groupDir, moduleName);
}

export function buildReleaseConfig(
  moduleName,
  parentKeys,
  language,
  templateContents,
  options = {},
) {
  const { repoUrl, packagesDir } = options;

  if (!repoUrl) throw new Error('repoUrl is required');
  if (!language) throw new Error('language is required');

  const packagePath = buildPackagePath(parentKeys, moduleName, packagesDir);
  const fragments = buildLanguageFragments(language, packagePath);

  let prepared = templateContents;
  prepared = replaceTemplateVariables('${MODULE_NAME}', moduleName, prepared);
  prepared = replaceTemplateVariables('${REPO_URL}', repoUrl, prepared);
  prepared = replaceTemplateVariables('${PACKAGE_PATH}', packagePath, prepared);
  prepared = replaceTemplateVariables(
    '${CHANGELOG_PATH}',
    `${packagePath}/CHANGELOG.md`,
    prepared,
  );
  prepared = replaceTemplateVariables('${NPM_PLUGIN}', fragments.npmPlugin, prepared);
  prepared = replaceTemplateVariables('${PREPARE_EXEC}', fragments.prepareExec, prepared);
  prepared = replaceTemplateVariables('${GIT_ASSETS}', fragments.gitAssets, prepared);

  return prepared;
}

export function upsertReleaseConfig(
  moduleName,
  parentKeys,
  language,
  templatePath,
  outputDirectory,
  options = {},
) {
  const templateContents = readFileContents(templatePath);
  const prepared = buildReleaseConfig(
    moduleName,
    parentKeys,
    language,
    templateContents,
    options,
  );
  const outputPath = `${outputDirectory}/release.${moduleName}.js`;
  writeConfig(outputPath, prepared);
  return outputPath;
}

export default upsertReleaseConfig;
