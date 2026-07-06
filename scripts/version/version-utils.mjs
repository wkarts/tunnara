const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export function parseVersion(value, label = 'Versão') {
  const raw = String(value ?? '').trim();
  const match = SEMVER_PATTERN.exec(raw);
  if (!match) throw new Error(`${label} inválida: ${value}`);

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  };
}

export function formatVersion(version, { includeBuild = true } = {}) {
  let result = `${version.major}.${version.minor}.${version.patch}`;
  if (version.prerelease?.length) result += `-${version.prerelease.join('.')}`;
  if (includeBuild && version.build?.length) result += `+${version.build.join('.')}`;
  return result;
}

function compareIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
}

export function compareVersions(leftValue, rightValue) {
  const left = typeof leftValue === 'string' ? parseVersion(leftValue) : leftValue;
  const right = typeof rightValue === 'string' ? parseVersion(rightValue) : rightValue;

  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }

  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const compared = compareIdentifier(leftPart, rightPart);
    if (compared !== 0) return compared;
  }

  return 0;
}

export function maxVersion(values, fallback = '0.0.0') {
  const parsed = values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .map((value) => ({ raw: value, parsed: parseVersion(value) }));

  if (!parsed.length) return fallback;
  parsed.sort((left, right) => compareVersions(left.parsed, right.parsed));
  return formatVersion(parsed.at(-1).parsed, { includeBuild: false });
}

export function baseVersion(value) {
  const parsed = typeof value === 'string' ? parseVersion(value) : value;
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

function incrementPrerelease(version) {
  const next = {
    ...version,
    prerelease: [...version.prerelease],
    build: [],
  };

  if (!next.prerelease.length) {
    next.patch += 1;
    next.prerelease = ['rc', '1'];
    return next;
  }

  for (let index = next.prerelease.length - 1; index >= 0; index -= 1) {
    if (/^\d+$/.test(next.prerelease[index])) {
      next.prerelease[index] = String(Number(next.prerelease[index]) + 1);
      return next;
    }
  }

  next.prerelease.push('1');
  return next;
}

export function nextVersion(currentValue, latestValue, bump = 'auto') {
  const current = parseVersion(currentValue, 'Versão atual');
  const latest = parseVersion(latestValue, 'Última versão publicada');
  const allowed = ['auto', 'prerelease', 'stable', 'patch', 'minor', 'major'];
  if (!allowed.includes(bump)) throw new Error(`Incremento SemVer inválido: ${bump}`);

  // Um PR pode trazer uma versão explicitamente superior à última release.
  // No modo automático essa versão é preservada no primeiro merge.
  if (bump === 'auto' && compareVersions(current, latest) > 0) {
    return formatVersion(current, { includeBuild: false });
  }

  const base = compareVersions(current, latest) >= 0 ? current : latest;
  let next;

  if (bump === 'auto') {
    next = base.prerelease.length
      ? incrementPrerelease(base)
      : { major: base.major, minor: base.minor, patch: base.patch + 1, prerelease: [], build: [] };
  } else if (bump === 'prerelease') {
    next = incrementPrerelease(base);
  } else if (bump === 'stable') {
    next = base.prerelease.length
      ? { ...base, prerelease: [], build: [] }
      : { major: base.major, minor: base.minor, patch: base.patch + 1, prerelease: [], build: [] };
  } else if (bump === 'major') {
    next = { major: base.major + 1, minor: 0, patch: 0, prerelease: [], build: [] };
  } else if (bump === 'minor') {
    next = { major: base.major, minor: base.minor + 1, patch: 0, prerelease: [], build: [] };
  } else {
    next = { major: base.major, minor: base.minor, patch: base.patch + 1, prerelease: [], build: [] };
  }

  return formatVersion(next, { includeBuild: false });
}

function prereleaseStage(prerelease) {
  if (!prerelease.length) return 9999;

  const channel = prerelease[0].toLowerCase();
  const ordinalPart = [...prerelease].reverse().find((part) => /^\d+$/.test(part));
  const ordinal = Math.min(Number(ordinalPart ?? 1), 999);
  const offsets = {
    dev: 0,
    nightly: 0,
    alpha: 1000,
    beta: 3000,
    preview: 5000,
    rc: 7000,
  };
  const offset = offsets[channel] ?? 5000;
  return Math.min(offset + ordinal, 9998);
}

export function windowsBundleVersion(value) {
  const parsed = typeof value === 'string' ? parseVersion(value) : value;
  const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (!parsed.prerelease.length) return base;

  // O MSI/WiX aceita somente um identificador de prerelease numérico <= 65535.
  // Reutilizamos a ordenação de canais do build mobile para evitar colisões
  // entre alpha, beta, preview e rc sem alterar a versão pública SemVer.
  const numericPrerelease = prereleaseStage(parsed.prerelease);
  if (!Number.isInteger(numericPrerelease) || numericPrerelease < 0 || numericPrerelease > 65_535) {
    throw new Error(`Versão ${formatVersion(parsed)} não pode ser convertida para versão MSI.`);
  }

  return `${base}-${numericPrerelease}`;
}

export function mobileBuildNumber(value) {
  const parsed = typeof value === 'string' ? parseVersion(value) : value;
  const number = (
    parsed.major * 100_000_000
    + parsed.minor * 1_000_000
    + parsed.patch * 10_000
    + prereleaseStage(parsed.prerelease)
  );

  if (!Number.isSafeInteger(number) || number <= 0 || number > 2_100_000_000) {
    throw new Error(`Versão ${formatVersion(parsed)} excede o limite de versionCode Android.`);
  }

  return number;
}
