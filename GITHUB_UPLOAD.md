# Publicação da Tunnara 2.0.0-rc.2 no GitHub

## Branch do Pull Request

```bash
git switch main
git pull --rebase origin main
git switch -c release/v2.0.0-rc2-production-hardening
```

Aplique o patch ou copie o conteúdo GitHub Ready, depois:

```bash
git add --all
git commit -m "feat: harden Tunnara 2.0.0 RC2 for production validation"
git push -u origin release/v2.0.0-rc2-production-hardening
```

## Release imutável

O arquivo `VERSION` está em `2.0.0-rc.2`. Após o merge, o workflow coordenado deve:

1. criar uma única release draft `v2.0.0-rc.2`;
2. gerar e enviar os assets centrais de forma sequencial e idempotente;
3. executar Runtime, SDK, Desktop, Mobile e Containers sobre a mesma tag;
4. anexar os artefatos diretamente à mesma release, sem Actions Artifact Storage;
5. publicar a prerelease somente se os jobs obrigatórios terminarem com sucesso.

Uma release já publicada nunca é reaberta e uma tag publicada nunca é movimentada. Para uma nova entrega, incremente `VERSION` antes do merge.

## Imagens GHCR esperadas

```text
ghcr.io/wkarts/tunnara-server:2.0.0-rc.2
ghcr.io/wkarts/tunnara-agent:2.0.0-rc.2
ghcr.io/wkarts/tunnara-console:2.0.0-rc.2
ghcr.io/wkarts/tunnara-control-api:2.0.0-rc.2
ghcr.io/wkarts/tunnara-quic-bridge:2.0.0-rc.2
ghcr.io/wkarts/tunnara-caddy-cloudflare:2.0.0-rc.2
```

## Ambiente distribuído — fallback TCP/TLS

```bash
cd deploy/docker
./tunnara.sh init
# configure domínio, Cloudflare, ACME, PostgreSQL e Redis no .env
./tunnara.sh up-distributed
./tunnara.sh bootstrap-distributed
./tunnara.sh status-distributed
```

## Ambiente distribuído — QUIC

```bash
cd deploy/docker
./tunnara.sh up-distributed-quic
./tunnara.sh status-distributed-quic
```

O overlay QUIC exporta os certificados administrados pelo Caddy para o `tunnara-quic-bridge` e publica UDP/7443.

## Operação

```bash
./tunnara.sh backup-distributed
./tunnara.sh update-distributed-quic
./tunnara.sh rollback-distributed-quic 2.0.0-rc.1
```

Consulte:

- `docs/operations/PRODUCTION_READINESS.md`;
- `docs/operations/UPGRADE_ROLLBACK.md`;
- `docs/operations/DISASTER_RECOVERY.md`;
- `docs/operations/INCIDENT_RESPONSE.md`.

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

A RC somente deve ser promovida para `2.0.0` após os testes descritos em `docs/security/MATURITY_GATES.md`, incluindo soak multi-host, caos, domínio real, dispositivos físicos, pentest e auditoria independente.
