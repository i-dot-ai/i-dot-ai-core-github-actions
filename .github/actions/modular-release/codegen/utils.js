import * as fs from 'fs';
import * as path from 'path';

/** Reads a file synchronously, decoding it as UTF-8. */
export function readFileContents(filePath) {
  return fs.readFileSync(filePath, { encoding: 'utf-8' });
}

/**
 * Replaces every occurrence of a template marker.
 *
 * Matching is literal, so a marker that is a prefix of another one (`${MODULE}`
 * within `${MODULE_NAME}`) is only safe to substitute after the longer marker.
 */
export function replaceTemplateVariables(targetString, replacementString, contents) {
  return contents.replaceAll(targetString, replacementString);
}

/**
 * Writes a generated configuration synchronously.
 *
 * Missing parent directories are created, and an existing file is replaced.
 */
export function writeConfig(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}
