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
  echo '[{"id":123,"tag_name":"v2.0.0-rc.7","draft":true}]'
  exit 0
fi
exit 91
`);

  const result = spawnSync('bash', [
    path.join(root, 'scripts/release/resolve-release-id.sh'),
    'v2.0.0-rc.7',
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
test('uploader usa release_id e uploads.github.com sem consultar /releases/tags/', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnara-release-uploader-'));
  const bin = path.join(temp, 'bin');
  const artifacts = path.join(temp, 'artifacts');
  const log = path.join(temp, 'calls.log');
  fs.mkdirSync(bin);
  fs.mkdirSync(artifacts);
  fs.writeFileSync(path.join(artifacts, 'artifact.txt'), 'tunnara\n');

  executable(path.join(bin, 'gh'), `#!/usr/bin/env bash
set -Eeuo pipefail
echo "gh $*" >> "${log}"
if [[ "$*" == *'/releases/tags/'* ]]; then
  echo 'endpoint de tag não permitido para draft' >&2
  exit 90
fi
if [[ "$*" == *'repos/test/repo/releases/123 --jq .tag_name'* ]]; then
  echo 'v2.0.0-rc.7'
  exit 0
fi
if [[ "$*" == *'repos/test/repo/releases/123/assets?per_page=100'* ]]; then
  echo '[{"id":456,"name":"artifact.txt"}]'
  exit 0
fi
if [[ "$*" == *'--method DELETE repos/test/repo/releases/assets/456'* ]]; then
  exit 0
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
printf '{"id":789,"name":"artifact.txt"}\n' > "$output"
printf '201'
`);

  const result = spawnSync('bash', [
    path.join(root, 'scripts/release/upload-release-assets.sh'),
    'v2.0.0-rc.7',
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
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /repos\/test\/repo\/releases\/123 --jq \.tag_name/);
  assert.match(calls, /--method DELETE repos\/test\/repo\/releases\/assets\/456/);
  assert.match(calls, /uploads\.github\.com\/repos\/test\/repo\/releases\/123\/assets\?name=artifact\.txt/);
  assert.doesNotMatch(calls, /releases\/tags\//);
});
