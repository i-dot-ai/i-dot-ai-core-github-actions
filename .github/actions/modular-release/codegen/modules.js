import * as yaml from 'js-yaml';
import * as fs from 'fs';

// Walks the modules.yml manifest, returning a flat list of
// `{ name, parentKeys }` objects. Group nesting is preserved as a
// dotted parentKeys path so the same shape works for the Node, Python,
// and Terraform consumers.
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
        leaves.push({ name: value, parentKeys: parentPath });
      });
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        const newPath = parentPath ? `${parentPath}.${key}` : key;
        leaves = leaves.concat(extractValues(obj[key], newPath));
      }
    }

    return leaves;
  }

  // Allow either `{ modules: { ... } }` or a bare `{ ... }` top level.
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
