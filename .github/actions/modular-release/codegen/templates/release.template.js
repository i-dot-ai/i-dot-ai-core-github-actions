const Configuration = {
  branches: ${BRANCHES},
  repositoryUrl: '${REPO_URL}',
  tagFormat: 'v${version}-${MODULE_NAME}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { scope: '${MODULE_NAME}', type: 'feat', release: 'minor' },
          { scope: '${MODULE_NAME}', type: 'fix', release: 'patch' },
          { scope: '${MODULE_NAME}', type: 'perf', release: 'patch' },
          { scope: '${MODULE_NAME}', type: 'refactor', release: 'patch' },
          { scope: '${MODULE_NAME}', type: 'chore', release: 'patch' },
          { scope: '${MODULE_NAME}', type: 'style', release: 'patch' },
          { scope: '${MODULE_NAME}', breaking: true, release: 'major' },
          { scope: '!${MODULE_NAME}', release: false },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        writerOpts: {
          transform: (commit) => {
            if (commit.scope !== '${MODULE_NAME}') return;
            return commit;
          },
        },
      },
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: '${CHANGELOG_PATH}',
      },
    ],
    ${PREPARE_EXEC}
    ${NPM_PLUGIN}
    [
      '@semantic-release/git',
      {
        assets: ${GIT_ASSETS},
        message: 'chore(release): ${nextRelease.version}-${MODULE_NAME} [skip ci]',
      },
    ],
    [
      '@semantic-release/github',
      {
        failTitle: false,
        failComment: false,
        successComment: false,
        releasedLabels: false,
      },
    ],
  ].filter(Boolean),
};

export default Configuration;
