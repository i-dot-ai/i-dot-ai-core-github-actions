const additionalPermittedScopes = [
  '${MODULES}',
  'config',
  'ci',
  'misc',
  'tests',
];

const Configuration = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', additionalPermittedScopes],
    'scope-empty': [2, 'never'],
  },
  defaultIgnores: true,
};

export default Configuration;
