# Publicação da correção Tunnara 2.0.0-rc.4 no GitHub

## Branch do Pull Request

```bash
git switch main
git pull --rebase origin main
git switch -c fix/v2.0.0-rc4-legacy-compose-audit
```

Aplique o patch recomendado:

```bash
git am /caminho/Tunnara-Platform-v2.0.0-rc.4.patch
git push -u origin fix/v2.0.0-rc4-legacy-compose-audit
```

Ou substitua o conteúdo pela versão GitHub Ready e faça o commit:

```bash
git add --all
git commit -m "fix(ci): integrate legacy QUIC compose and harden version validation"
git push -u origin fix/v2.0.0-rc4-legacy-compose-audit
```

## Diagnóstico confirmado

Os workflows em `.github/workflows` da cópia local eram equivalentes aos da
RC.3. A falha não foi causada por um workflow antigo adicional.

O bloqueio ocorreu em `npm run version:check` porque o arquivo local extra:

```text
deploy/docker/docker-compose.distributed.quic.yml
```

referenciava `tunnara-quic-bridge:2.0.0-rc.2` em um projeto já versionado como
`2.0.0-rc.3`.

## Comportamento após o merge

O arquivo `VERSION` deste pacote está em `2.0.0-rc.4`.

- releases publicadas não são reabertas;
- tags publicadas não são movidas;
- drafts e tags existentes entram no cálculo da próxima versão;
- todos os builds recebem a mesma versão e o mesmo SHA;
- o merge deve criar a release coordenada `v2.0.0-rc.4` quando ela ainda não existir.

## Perfil distribuído TCP

```bash
cd deploy/docker
./tunnara.sh init
./tunnara.sh preflight-distributed
./tunnara.sh up-distributed
./tunnara.sh bootstrap-distributed
./tunnara.sh status-distributed
```

## Perfil distribuído QUIC

```bash
cd deploy/docker
./tunnara.sh init
./tunnara.sh preflight-distributed-quic
./tunnara.sh up-distributed-quic
./tunnara.sh bootstrap-distributed-quic
./tunnara.sh status-distributed-quic
```

## Backup, atualização e rollback

```bash
./tunnara.sh backup-distributed
./tunnara.sh update-distributed-quic
./tunnara.sh rollback-distributed-quic 2.0.0-rc.3
```

A restauração exige confirmação explícita:

```bash
./tunnara.sh restore-distributed /caminho/backup.dump --force
```

## Imagens GHCR esperadas

```text
ghcr.io/wkarts/tunnara-server:2.0.0-rc.4
ghcr.io/wkarts/tunnara-agent:2.0.0-rc.4
ghcr.io/wkarts/tunnara-console:2.0.0-rc.4
ghcr.io/wkarts/tunnara-control-api:2.0.0-rc.4
ghcr.io/wkarts/tunnara-quic-bridge:2.0.0-rc.4
ghcr.io/wkarts/tunnara-caddy-cloudflare:2.0.0-rc.4
```

## Antes do merge

Execute:

```bash
npm ci --ignore-scripts
npm run version:check
npm run repository:check
npm run validate:docker
npm run validate:release
```

O GitHub Actions executará os builds nativos e a validação real do Docker
Compose nos runners apropriados.
