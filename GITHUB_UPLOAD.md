# Publicação da correção Tunnara 2.0.0-rc.2 no GitHub

## Branch do Pull Request

```bash
git switch main
git pull --rebase origin main
git switch -c fix/v2.0.0-rc2-validation-autoversion
```

Copie o conteúdo do pacote corrigido e execute:

```bash
git add --all
git commit -m "fix(release): correct validation and add immutable version automation"
git push -u origin fix/v2.0.0-rc2-validation-autoversion
```

## Comportamento após o merge

O arquivo `VERSION` deste pacote está em `2.0.0-rc.2`.

- Se não existir release igual ou superior, o workflow preserva `2.0.0-rc.2`.
- Se `2.0.0-rc.2` já existir, o workflow avança automaticamente para `2.0.0-rc.3`.
- Releases draft também entram no cálculo para impedir colisão de versão.
- Releases publicadas não são reabertas e tags publicadas não são movidas.

A release coordenada recebe a versão e o SHA exato do commit de preparação. Core, Runtime, SDK, Desktop, Mobile e Containers compilam esse mesmo SHA.

## Reexecutar uma draft interrompida

Abra `Actions → Release after merge → Run workflow` e informe exatamente:

```text
release_version: versão da draft
release_sha: SHA original da draft
```

Não use outro SHA para a mesma versão. Uma release já publicada exige uma nova versão.

## Imagens GHCR esperadas para esta revisão

```text
ghcr.io/wkarts/tunnara-server:2.0.0-rc.2
ghcr.io/wkarts/tunnara-agent:2.0.0-rc.2
ghcr.io/wkarts/tunnara-console:2.0.0-rc.2
ghcr.io/wkarts/tunnara-control-api:2.0.0-rc.2
ghcr.io/wkarts/tunnara-quic-bridge:2.0.0-rc.2
ghcr.io/wkarts/tunnara-caddy-cloudflare:2.0.0-rc.2
```

## Ambiente distribuído

```bash
cd deploy/docker
./tunnara.sh init
# configure domínio, Cloudflare e ACME no .env
./tunnara.sh up-distributed
./tunnara.sh bootstrap-distributed
./tunnara.sh status-distributed
```

## Observabilidade

```bash
cd deploy/docker
./tunnara.sh up-observability
```

## Kubernetes

```bash
helm upgrade --install tunnara deploy/helm/tunnara \
  --namespace tunnara --create-namespace \
  --set-string server.adminToken='tnr_admin_...' \
  --set-string server.masterKey='...' \
  --set-string server.clusterToken='tnr_cluster_...'
```
