# Publicação da Tunnara 2.0.0-rc.1 no GitHub

## Branch do Pull Request

```bash
git switch main
git pull --rebase origin main
git switch -c release/v2.0.0-rc1-platform-hardening
```

Aplique o patch ou copie o conteúdo GitHub Ready, depois:

```bash
git add --all
git commit -m "feat: deliver Tunnara 2.0.0 RC platform hardening"
git push -u origin release/v2.0.0-rc1-platform-hardening
```

## Release

O arquivo `VERSION` está em `2.0.0-rc.1`. Após o merge, o workflow de release deve:

1. criar `v2.0.0-rc.1` como draft;
2. gerar os assets centrais;
3. executar Runtime, SDK, Desktop, Mobile e Containers;
4. anexar os artefatos diretamente à release;
5. publicar a release somente se os jobs obrigatórios terminarem com sucesso.

Para reconstrução manual:

```text
Actions → Release after merge → Run workflow
force_rebuild: true
```

## Imagens GHCR esperadas

```text
ghcr.io/wkarts/tunnara-server:2.0.0-rc.1
ghcr.io/wkarts/tunnara-agent:2.0.0-rc.1
ghcr.io/wkarts/tunnara-console:2.0.0-rc.1
ghcr.io/wkarts/tunnara-control-api:2.0.0-rc.1
ghcr.io/wkarts/tunnara-quic-bridge:2.0.0-rc.1
ghcr.io/wkarts/tunnara-caddy-cloudflare:2.0.0-rc.1
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

## Gates de promoção para GA

A tag RC deve ser promovida para `2.0.0` somente após os testes descritos em `docs/security/MATURITY_GATES.md`.
