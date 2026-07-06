# Auditoria de scripts, workflows e Compose legados

## Escopo

A auditoria comparou a cópia local enviada no Pull Request com o pacote oficial
Tunnara 2.0.0-rc.3 e com os logs do GitHub Actions.

## Causa confirmada da falha

O único erro do workflow anexado ocorreu em `Core and runtime`, durante
`npm run version:check`:

```text
deploy/docker/docker-compose.distributed.quic.yml: imagem 2.0.0-rc.2 != 2.0.0-rc.3
```

O arquivo `docker-compose.distributed.quic.yml` existia apenas na cópia local
e não estava integrado ao launcher Docker oficial. O Console Vue, o Control API
distribuído e a validação principal de Docker concluíram sem erro.

## Arquivos legados encontrados

### Corrigidos e incorporados

- `deploy/docker/docker-compose.distributed.quic.yml`: promovido de overlay órfão
  para perfil oficialmente suportado pelo `tunnara.sh`.
- `docs/operations/PRODUCTION_READINESS.md`: comandos alinhados ao launcher.
- `docs/operations/UPGRADE_ROLLBACK.md`: backup, update, restore e rollback
  distribuídos passaram a existir no launcher.

### Removidos

- `deploy/docker/docker-compose.infrastructure.yml`: protótipo antigo, sem
  referência, misturava builds locais e uma arquitetura anterior.
- `scripts/ci/base64-decode.sh`: helper não referenciado por workflow ou script.
- `ARTIFACT_MANIFEST.md.bak`.
- `GITHUB_UPLOAD.md.bak`.
- `PROJECT_TREE.txt.bak`.
- `VALIDATION_REPORT.md.bak`.

### Preservados

- Documentos operacionais de disaster recovery e resposta a incidentes.
- Scripts Windows; o conteúdo era igual ao pacote oficial, divergindo apenas em
  finais de linha. Eles foram normalizados para CRLF conforme `.gitattributes`.
- Workflows em `.github/workflows`; a comparação não encontrou workflows locais
  antigos adicionais ou conteúdo divergente do pacote RC.3.

## Lacuna adicional encontrada

Os exemplos:

- `deploy/docker/examples/docker-compose.local.yml`;
- `deploy/docker/examples/docker-compose.vps.yml`;

mantinham fallbacks `${TUNNARA_VERSION:-1.1.1}`. A validação anterior não
identificava versões dentro dessa forma de interpolação. O sincronizador e o
validador agora tratam também fallbacks `${TUNNARA_VERSION:-X.Y.Z}`.

## Proteções adicionadas

- Rejeição de arquivos `.bak`, `.orig` e `.rej`.
- Rejeição de Compose na raiz de `deploy/docker` sem integração no launcher.
- Validação de imagens com tag fixa e com fallback `TUNNARA_VERSION`.
- Validação do Compose distribuído combinado com o overlay QUIC.
- Testes negativos confirmando que os três cenários são bloqueados pela CI.
