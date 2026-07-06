import { nextVersion } from './version-utils.mjs';

const [current, latest, bump = 'auto'] = process.argv.slice(2);
process.stdout.write(`${nextVersion(current, latest, bump)}\n`);
