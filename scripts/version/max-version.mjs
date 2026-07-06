import fs from 'node:fs';
import { maxVersion } from './version-utils.mjs';

const argumentsList = process.argv.slice(2);
const values = argumentsList.length
  ? argumentsList
  : fs.readFileSync(0, 'utf8').split(/\r?\n/);

process.stdout.write(`${maxVersion(values)}\n`);
