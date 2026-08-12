import * as yaml from 'js-yaml';
import * as fs from 'fs';

/**
 * Reads and validates a modules manifest.
 *
 * The manifest may be a bare mapping or use a top-level `modules` key. Each
 * module name must be unique across all groups, regardless of its directory.
 *
 * @param {string} modulePath Path to the YAML manifest.
 * @returns {{name: string, packageDir: string}[]} Modules in manifest order,
 * where `packageDir` is the module group's directory as a POSIX-relative path.
 * @throws {Error} If the file cannot be read or parsed, or names are duplicated.
 */
function getAndValidateModules(modulePath) {
  const moduleInfo = getModuleNamesAndPath(modulePath);

  if (dictKeyHasDuplicates('name', moduleInfo)) {
    const keys = moduleInfo.map((item) => item.name);
    throw new Error(
      `Modules must not have duplicate names, irrespective of their directories. Rename the duplicate. Modules: ${keys}`,
    );
  }

  return moduleInfo;
}

function getModuleNamesAndPath(yamlFilePath) {
  const fileContents = fs.readFileSync(yamlFilePath);
  const parsedYaml = yaml.load(fileContents);

  function extractValues(obj, parentPath = '') {
    let leaves = [];

    if (Array.isArray(obj)) {
      obj.forEach((value) => {
        leaves.push({ name: value, packageDir: parentPath });
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        // Nested manifest keys join with '/' so the value is directly usable as
        // a directory path; there is no separate manifest-path representation to
        // reconcile downstream.
        const newPath = parentPath ? `${parentPath}/${key}` : key;
        leaves = leaves.concat(extractValues(obj[key], newPath));
      }
    }

    return leaves;
  }

  const root = parsedYaml && parsedYaml.modules ? parsedYaml.modules : parsedYaml;
  return extractValues(root);
}

function dictKeyHasDuplicates(keyName, dictList) {
  const seen = new Set();
  for (const item of dictList) {
    if (keyName in item) {
      const value = item[keyName];
      if (seen.has(value)) return true;
      seen.add(value);
    }
  }
  return false;
}

export default getAndValidateModules;
