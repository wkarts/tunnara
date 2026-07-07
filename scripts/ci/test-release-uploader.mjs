import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();

function executable(file, content) {
  fs.writeFileSync(file, content, { mode: 0o755 });
}

function runUploader({ bin, artifacts, extraEnv = {} }) {
  return spawnSync('bash', [
    path.join(root, 'scripts/release/upload-release-assets.sh'),
    'v2.0.0-rc.8',
    artifacts,
    '123',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_REPOSITORY: 'test/repo',
      GH_TOKEN: 'test-token',
      TUNNARA_RELEASE_POLL_SECONDS: '0',
      ...extraEnv,
    },
  });
}

test('resolver encontra draft pela listagem geral de releases', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-release-resolver-'));
  const bin = path.join(temp, 'bin');
  const log = path.join(temp, 'calls.log');
  fs.mkdirSync(bin);

  executable(path.join(bin, 'gh'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "gh $*" >> "${log}"
if [[ "$*" == *'/releases/tags/'* ]]; then
  exit 90
fi
if [[ "$*" == *'repos/test/repo/releases?per_page=100'* ]]; then
  echo '[{"id":123,"tag_name":"v2.0.0-rc.8","draft":true}]'
  exit 0
fi
exit 91
`);

  const result = spawnSync('bash', [
    path.join(root, 'scripts/release/resolve-release-id.sh'),
    'v2.0.0-rc.8',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_REPOSITORY: 'test/repo',
      GH_TOKEN: 'test-token',
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(result.stdout.trim(), '123');
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /repos\/test\/repo\/releases\?per_page=100/);
  assert.doesNotMatch(calls, /releases\/tags\//);
});

test('uploader remove asset starter e envia pelo release_id', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-release-uploader-starter-'));
  const bin = path.join(temp, 'bin');
  const artifacts = path.join(temp, 'artifacts');
  const log = path.join(temp, 'calls.log');
  const deleted = path.join(temp, 'deleted');
  fs.mkdirSync(bin);
  fs.mkdirSync(artifacts);
  fs.writeFileSync(path.join(artifacts, 'artifact.txt'), 'tunnara\n');

  executable(path.join(bin, 'gh'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "gh $*" >> "${log}"
if [[ "$*" == *'/releases/tags/'* ]]; then exit 90; fi
if [[ "$*" == *'repos/test/repo/releases/123 --jq .tag_name'* ]]; then
  echo 'v2.0.0-rc.8'; exit 0
fi
if [[ "$*" == *'repos/test/repo/releases/123/assets?per_page=100&page=1'* ]]; then
  if [[ -f "${deleted}" ]]; then echo '[]'; else echo '[{"id":456,"name":"artifact.txt","state":"starter","size":0}]'; fi
  exit 0
fi
if [[ "$*" == *'--method DELETE repos/test/repo/releases/assets/456'* ]]; then
  touch "${deleted}"; exit 0
fi
echo "chamada gh inesperada: $*" >&2
exit 91
`);

  executable(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "curl $*" >> "${log}"
output=''
while (($#)); do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    *) shift ;;
  esac
done
printf '{"id":789,"name":"artifact.txt","state":"uploaded","size":8}\n' > "$output"
printf '201'
`);

  const result = runUploader({ bin, artifacts });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /--method DELETE repos\/test\/repo\/releases\/assets\/456/);
  assert.match(calls, /uploads\.github\.com\/repos\/test\/repo\/releases\/123\/assets\?name=artifact\.txt/);
  assert.doesNotMatch(calls, /releases\/tags\//);
});

test('uploader aceita asset completo que já existe sem apagar ou reenviar', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-release-uploader-existing-'));
  const bin = path.join(temp, 'bin');
  const artifacts = path.join(temp, 'artifacts');
  const log = path.join(temp, 'calls.log');
  fs.mkdirSync(bin);
  fs.mkdirSync(artifacts);
  fs.writeFileSync(path.join(artifacts, 'artifact.txt'), 'tunnara\n');

  executable(path.join(bin, 'gh'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "gh $*" >> "${log}"
if [[ "$*" == *'repos/test/repo/releases/123 --jq .tag_name'* ]]; then
  echo 'v2.0.0-rc.8'; exit 0
fi
if [[ "$*" == *'repos/test/repo/releases/123/assets?per_page=100&page=1'* ]]; then
  echo '[{"id":456,"name":"artifact.txt","state":"uploaded","size":8,"digest":"sha256:test"}]'; exit 0
fi
exit 91
`);

  executable(path.join(bin, 'curl'), `#!/usr/bin/env bash
echo 'curl não deveria ser chamado' >> "${log}"
exit 99
`);

  const result = runUploader({ bin, artifacts });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Asset completo já existe; upload idempotente ignorado/);
  const calls = fs.readFileSync(log, 'utf8');
  assert.doesNotMatch(calls, /^curl /m);
  assert.doesNotMatch(calls, /--method DELETE/);
});

test('uploader converte HTTP 422 concorrente em sucesso quando o asset termina', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-release-uploader-race-'));
  const bin = path.join(temp, 'bin');
  const artifacts = path.join(temp, 'artifacts');
  const log = path.join(temp, 'calls.log');
  const counter = path.join(temp, 'counter');
  fs.mkdirSync(bin);
  fs.mkdirSync(artifacts);
  fs.writeFileSync(path.join(artifacts, 'artifact.txt'), 'tunnara\n');
  fs.writeFileSync(counter, '0');

  executable(path.join(bin, 'gh'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "gh $*" >> "${log}"
if [[ "$*" == *'repos/test/repo/releases/123 --jq .tag_name'* ]]; then
  echo 'v2.0.0-rc.8'; exit 0
fi
if [[ "$*" == *'repos/test/repo/releases/123/assets?per_page=100&page=1'* ]]; then
  value=$(cat "${counter}")
  value=$((value + 1))
  echo "$value" > "${counter}"
  if ((value >= 3)); then
    echo '[{"id":999,"name":"artifact.txt","state":"uploaded","size":8,"digest":"sha256:test"}]'
  else
    echo '[]'
  fi
  exit 0
fi
exit 91
`);

  executable(path.join(bin, 'curl'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "curl $*" >> "${log}"
output=''
while (($#)); do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    *) shift ;;
  esac
done
printf '{"message":"Validation Failed","errors":[{"resource":"ReleaseAsset","code":"already_exists","field":"name"}]}\n' > "$output"
printf '422'
`);

  const result = runUploader({
    bin,
    artifacts,
    extraEnv: { TUNNARA_RELEASE_COLLISION_POLLS: '5' },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(`${result.stdout}\n${result.stderr}`, /Asset já concluído por outro job\/run/);
  const calls = fs.readFileSync(log, 'utf8');
  assert.equal((calls.match(/^curl /gm) ?? []).length, 1);
  assert.doesNotMatch(calls, /--method DELETE/);
});
