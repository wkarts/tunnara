import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const required = [
  'apps/control-api/config/database.php',
  'apps/control-api/config/cache.php',
  'apps/control-api/database/migrations/2026_07_05_000002_create_runtime_support_tables.php',
  'deploy/docker/storage/docker-compose.base.yml',
  'deploy/docker/storage/docker-compose.sqlite.yml',
  'deploy/docker/storage/docker-compose.postgres.yml',
  'deploy/docker/storage/docker-compose.mysql.yml',
  'deploy/docker/storage/docker-compose.redis.yml',
  'deploy/docker/storage/storage.sh',
];

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Perfil de storage ausente: ${relative}`);
}

const database = fs.readFileSync(path.join(root, 'apps/control-api/config/database.php'), 'utf8');
for (const driver of ["'sqlite'", "'pgsql'", "'mysql'"]) {
  if (!database.includes(driver)) throw new Error(`Driver de banco não configurado: ${driver}`);
}
for (const connection of ["'default'", "'cache'", "'session'", "'queue'"]) {
  if (!database.includes(connection)) throw new Error(`Conexão Redis não configurada: ${connection}`);
}

const cache = fs.readFileSync(path.join(root, 'apps/control-api/config/cache.php'), 'utf8');
for (const store of ["'array'", "'file'", "'database'", "'redis'"]) {
  if (!cache.includes(store)) throw new Error(`Store de cache não configurado: ${store}`);
}

const runtime = fs.readFileSync(path.join(root, 'runtime/node/bin/tunnara-server.mjs'), 'utf8');
if (!runtime.includes("['sqlite', 'memory']")) throw new Error('Runtime embedded não declara sqlite e memory.');

const ha = fs.readFileSync(path.join(root, 'deploy/docker/docker-compose.ha.yml'), 'utf8');
const controls = [...ha.matchAll(/^\s{2}control(?:-[a-z])?:\s*$/gm)].length;
if (controls !== 1) throw new Error(`Compose HA deve possuir um único Control SQLite; encontrados: ${controls}`);

console.log('STORAGE_PROFILES_OK sqlite, memory, PostgreSQL, MySQL, local, database e Redis configurados.');
