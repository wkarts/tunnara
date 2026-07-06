import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const errors = [];
const required = [
  'docker.sh',
  'docker.env.example',
  'docker-compose.example.yml',
  'deploy/docker/.env.example',
  'deploy/docker/tunnara.sh',
  'deploy/docker/bootstrap.sh',
  'deploy/docker/install-from-github.sh',
  'deploy/docker/docker-compose.yml',
  'deploy/docker/docker-compose.build.yml',
  'deploy/docker/docker-compose.cloudflare.yml',
  'deploy/docker/docker-compose.cloudflare.build.yml',
  'deploy/docker/docker-compose.quic.yml',
  'deploy/docker/docker-compose.quic.build.yml',
  'deploy/docker/docker-compose.ha.yml',
  'deploy/docker/docker-compose.ha.build.yml',
  'deploy/docker/storage/docker-compose.base.yml',
  'deploy/docker/storage/docker-compose.build.yml',
  'deploy/docker/storage/docker-compose.sqlite.yml',
  'deploy/docker/storage/docker-compose.postgres.yml',
  'deploy/docker/storage/docker-compose.mysql.yml',
  'deploy/docker/storage/docker-compose.redis.yml',
  'deploy/docker/README.md',
  'docs/operations/DOCKER_DEPLOYMENT.md',
  'docs/operations/VPS_DOCKER_QUICKSTART.md',
  'deploy/docker/examples/local.env.example',
  'deploy/docker/examples/vps.env.example',
  'deploy/docker/examples/docker-compose.local.yml',
  'deploy/docker/examples/docker-compose.vps.yml',
];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

if (!errors.length) {
  const cargoToml = read('Cargo.toml');
  const quicDockerfile = read('deploy/docker/quic/Dockerfile');
  const rustVersion = cargoToml.match(/rust-version\s*=\s*"([^"]+)"/)?.[1];
  const dockerRustVersion = quicDockerfile.match(/^FROM rust:([0-9.]+)-bookworm AS builder$/m)?.[1];
  if (!rustVersion || !dockerRustVersion) errors.push('Não foi possível determinar o MSRV Rust ou a imagem builder QUIC.');
  else if (rustVersion !== dockerRustVersion) errors.push(`Docker QUIC usa Rust ${dockerRustVersion}, divergente do rust-version ${rustVersion}.`);
  if (rustVersion && Number(rustVersion.split('.')[1]) < 85) errors.push(`Rust ${rustVersion} é incompatível com reqwest 0.13; use 1.85 ou superior.`);

  const rootEnv = read('docker.env.example');
  const rootCompose = read('docker-compose.example.yml');
  if (!rootEnv.includes(`TUNNARA_VERSION=${version}`)) errors.push('docker.env.example não acompanha VERSION.');
  if (!rootCompose.includes(`TUNNARA_VERSION:-${version}`)) errors.push('docker-compose.example.yml não acompanha VERSION.');

  const env = read('deploy/docker/.env.example');
  if (!env.includes(`TUNNARA_VERSION=${version}`)) errors.push('.env.example não acompanha VERSION.');
  for (const image of ['server', 'agent', 'console', 'control-api', 'caddy-cloudflare', 'quic-bridge']) {
    if (!env.includes(`tunnara-${image}:${version}`)) errors.push(`.env.example não contém tunnara-${image}:${version}.`);
  }
  if (/wwsoftwares/i.test(env)) errors.push('.env.example ainda contém o registry legado wwsoftwares.');
  if (!/TUNNARA_STORAGE_DRIVER=sqlite/.test(env)) errors.push('Storage SQLite padrão não está documentado no .env Docker.');

  const imageComposes = [
    'deploy/docker/docker-compose.yml',
    'deploy/docker/docker-compose.cloudflare.yml',
    'deploy/docker/docker-compose.quic.yml',
    'deploy/docker/docker-compose.ha.yml',
    'deploy/docker/storage/docker-compose.base.yml',
    'deploy/docker/storage/docker-compose.sqlite.yml',
    'deploy/docker/storage/docker-compose.postgres.yml',
    'deploy/docker/storage/docker-compose.mysql.yml',
    'deploy/docker/storage/docker-compose.redis.yml',
  ];
  for (const file of imageComposes) {
    const source = read(file);
    if (/^\s*build:\s*$/m.test(source)) errors.push(`${file}: compose de distribuição não deve conter build; use o override *.build.yml.`);
    if (/wwsoftwares/i.test(source)) errors.push(`${file}: contém registry legado wwsoftwares.`);
    const stale = source.match(/tunnara-[a-z0-9-]+:(\d+\.\d+\.\d+)/gi) ?? [];
    for (const occurrence of stale) {
      if (!occurrence.endsWith(`:${version}`)) errors.push(`${file}: tag divergente de VERSION em ${occurrence}.`);
    }
  }

  for (const file of [
    'deploy/docker/docker-compose.build.yml',
    'deploy/docker/docker-compose.cloudflare.build.yml',
    'deploy/docker/docker-compose.quic.build.yml',
    'deploy/docker/docker-compose.ha.build.yml',
    'deploy/docker/storage/docker-compose.build.yml',
  ]) {
    if (!/^\s*build:\s*$/m.test(read(file))) errors.push(`${file}: override local não contém build.`);
  }

  const launcher = read('deploy/docker/tunnara.sh');
  for (const command of ['quickstart', 'quickstart-build', 'up-production', 'update-production', 'backup', 'restore', 'provision']) {
    if (!launcher.includes(`${command})`) && !launcher.includes(` ${command}`)) errors.push(`tunnara.sh não expõe o comando ${command}.`);
  }
  if (!launcher.includes('TUNNARA_DEPLOY_MODE')) errors.push('tunnara.sh não diferencia image/build.');

  const installer = read('deploy/docker/install-from-github.sh');
  if (!installer.includes('Tunnara-Docker-{tag}.zip')) errors.push('Instalador GitHub não procura o bundle Docker da release.');
  if (!installer.includes('GITHUB_TOKEN')) errors.push('Instalador GitHub não suporta repositórios privados via GITHUB_TOKEN.');

  const docs = `${read('README.md')}\n${read('deploy/docker/README.md')}\n${read('docs/operations/DOCKER_DEPLOYMENT.md')}\n${read('docs/operations/VPS_DOCKER_QUICKSTART.md')}`;
  for (const fragment of ['./docker.sh quickstart', './tunnara.sh quickstart', 'docker-compose.example.yml', 'docker-compose.vps.yml', 'PostgreSQL', 'MySQL', 'Redis', 'SQLite']) {
    if (!docs.includes(fragment)) errors.push(`Documentação Docker não contém: ${fragment}`);
  }
}

if (errors.length) {
  console.error('DOCKER_DEPLOYMENT_INVALID');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`DOCKER_DEPLOYMENT_OK imagens ${version}, quickstart, produção, build local e providers validados.`);
