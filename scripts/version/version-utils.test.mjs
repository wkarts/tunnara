import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions,
  maxVersion,
  mobileBuildNumber,
  nextVersion,
} from './version-utils.mjs';

test('ordena prereleases segundo SemVer e considera stable superior', () => {
  assert.ok(compareVersions('2.0.0-rc.2', '2.0.0-rc.1') > 0);
  assert.ok(compareVersions('2.0.0', '2.0.0-rc.99') > 0);
  assert.equal(maxVersion(['1.1.2', '2.0.0-rc.2', '2.0.0-rc.1']), '2.0.0-rc.2');
});

test('preserva uma versão explicitamente adiantada no primeiro merge', () => {
  assert.equal(nextVersion('2.0.0-rc.2', '1.1.2', 'auto'), '2.0.0-rc.2');
});

test('incrementa automaticamente prerelease e release estável', () => {
  assert.equal(nextVersion('2.0.0-rc.2', '2.0.0-rc.2', 'auto'), '2.0.0-rc.3');
  assert.equal(nextVersion('1.1.3', '1.1.3', 'auto'), '1.1.4');
});

test('promove RC e respeita bumps explícitos', () => {
  assert.equal(nextVersion('2.0.0-rc.2', '2.0.0-rc.2', 'stable'), '2.0.0');
  assert.equal(nextVersion('2.0.0-rc.2', '2.0.0-rc.2', 'patch'), '2.0.1');
  assert.equal(nextVersion('2.0.0', '2.0.0', 'prerelease'), '2.0.1-rc.1');
});

test('gera build mobile monotônico para prerelease e stable', () => {
  const rc1 = mobileBuildNumber('2.0.0-rc.1');
  const rc2 = mobileBuildNumber('2.0.0-rc.2');
  const stable = mobileBuildNumber('2.0.0');
  const nextPatch = mobileBuildNumber('2.0.1-rc.1');
  assert.equal(rc2, 200_007_002);
  assert.ok(rc1 < rc2);
  assert.ok(rc2 < stable);
  assert.ok(stable < nextPatch);
});
