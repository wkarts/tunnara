export default {
  branches: ['main', { name: 'next', prerelease: true }],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
    [
      '@semantic-release/exec',
      {
        prepareCmd: [
          'node scripts/version/set-version.mjs ${nextRelease.version}',
          'npm --prefix apps/console ci',
          'npm --prefix apps/console run build:web',
          'node scripts/release/build-sea.mjs agent dist/tunnara-agent-linux-x64',
          'node scripts/release/build-sea.mjs server dist/tunnara-server-linux-x64',
          'TUNNARA_E2E_AGENT_BIN=dist/tunnara-agent-linux-x64 TUNNARA_E2E_SERVER_BIN=dist/tunnara-server-linux-x64 npm run runtime:test',
          'bash scripts/release/package-artifacts.sh',
        ].join(' && '),
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          { path: 'artifacts/*-complete.zip', label: 'Pacote completo Tunnara' },
          { path: 'artifacts/*-github-ready.zip', label: 'Repositório pronto para GitHub' },
          { path: 'artifacts/*-git-repository.bundle', label: 'Repositório Git cloneável com tag' },
          { path: 'artifacts/*-source.zip', label: 'Código-fonte Tunnara (ZIP)' },
          { path: 'artifacts/*-source.tar.gz', label: 'Código-fonte Tunnara (TAR.GZ)' },
          { path: 'artifacts/tunnara-console-web-*.zip', label: 'Console web compilado' },
          { path: 'artifacts/tunnara-runtime-linux-*.zip', label: 'Runtime Linux standalone' },
          { path: 'artifacts/tunnara-runtime-linux-*.tar.gz', label: 'Runtime Linux standalone (TAR.GZ)' },
          { path: 'artifacts/SHA256SUMS.txt', label: 'Checksums SHA-256' },
        ],
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'VERSION', 'package.json', 'package-lock.json', 'Cargo.toml',
          'runtime/node/package.json', 'runtime/node/lib/utils.mjs',
          'apps/control-api/.env.example', 'apps/control-api/config/app.php',
          'apps/console/package.json', 'apps/console/package-lock.json',
          'apps/console/src-tauri/Cargo.toml', 'apps/console/src-tauri/generic-license-tauri/Cargo.toml',
          'apps/console/src-tauri/tauri.conf.json',
          'apps/console/src/config/projectConfig.ts', 'apps/console/src/assets/branding/brand.json',
          'apps/console/VERSION', 'deploy/docker/docker-compose.yml', 'CHANGELOG.md',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
