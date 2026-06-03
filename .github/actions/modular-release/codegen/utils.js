import * as fs from 'fs';
import * as path from 'path';

export function readFileContents(filePath) {
  return fs.readFileSync(filePath, { encoding: 'utf-8' });
}

export function replaceTemplateVariables(targetString, replacementString, contents) {
  return contents.replaceAll(targetString, replacementString);
}

export function writeConfig(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

export function directoryExists(p) {
  return fs.existsSync(p);
}
