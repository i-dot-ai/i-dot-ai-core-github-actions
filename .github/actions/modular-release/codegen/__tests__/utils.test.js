import { replaceTemplateVariables } from '../utils.js';

describe('template utilities', () => {
  // Substitution order in release.js depends on shorter markers leaving longer
  // ones that contain them intact.
  test('leaves a longer marker untouched when replacing a prefix of it', () => {
    expect(
      replaceTemplateVariables('${MODULE}', 'auth', '${MODULE}/${MODULE_NAME}/${MODULE}'),
    ).toBe('auth/${MODULE_NAME}/auth');
  });
});
