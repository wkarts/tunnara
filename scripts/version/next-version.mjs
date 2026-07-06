const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/;

function parse(value, label) {
  const match = semverPattern.exec(String(value ?? '').trim());
  if (!match) throw new Error(`${label} inválida: ${value}`);
  return match.slice(1).map(Number);
}

function compare(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

const [currentRaw, latestRaw, bump = 'patch'] = process.argv.slice(2);
const current = parse(currentRaw, 'Versão atual');
const latest = parse(latestRaw, 'Última versão publicada');

if (!['patch', 'minor', 'major'].includes(bump)) {
  throw new Error(`Incremento SemVer inválido: ${bump}`);
}

let next;
if (compare(current, latest) > 0) {
  // Respeita um bump explícito já incluído no Pull Request.
  next = current;
} else {
  const base = compare(current, latest) >= 0 ? current : latest;
  if (bump === 'major') next = [base[0] + 1, 0, 0];
  else if (bump === 'minor') next = [base[0], base[1] + 1, 0];
  else next = [base[0], base[1], base[2] + 1];
}

process.stdout.write(`${next.join('.')}\n`);
