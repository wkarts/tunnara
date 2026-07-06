# Relatório de validação — Tunnara Platform 2.0.0-rc.4

## Diagnóstico dos logs

O pacote `logs_77802296964.zip` contém quatro jobs de Pull Request:

- Core and runtime;
- Distributed Control API;
- Docker configuration;
- Console Vue.

Somente `Core and runtime` falhou. A interrupção ocorreu antes dos testes de
runtime, em `npm run version:check`, por uma tag antiga no overlay distribuído
QUIC:

```text
deploy/docker/docker-compose.distributed.quic.yml: imagem 2.0.0-rc.2 != 2.0.0-rc.3
```

Os demais jobs não apresentaram erro de build no log anexado.

## Auditoria da cópia local

A comparação com o pacote oficial RC.3 confirmou:

- os 14 workflows atuais eram equivalentes aos do pacote oficial;
- não havia workflow legado adicional em `.github/workflows`;
- havia um Compose distribuído QUIC extra e não integrado;
- havia backups `.bak` de versões antigas;
- havia um helper Base64 sem uso;
- havia um Compose `infrastructure` antigo sem referência;
- exemplos Docker ainda possuíam fallback de imagem `1.1.1`;
- scripts Windows divergiam apenas em LF/CRLF.

## Correções

- versão elevada para `2.0.0-rc.4`;
- build mobile sincronizado em `200007004`;
- overlay distribuído QUIC integrado ao `tunnara.sh`;
- perfil distribuído padrão corrigido para anunciar Relay TCP;
- perfil QUIC sobrescreve a descoberta para `quic://`;
- composição combinada incluída no CI;
- backup, restore, update e rollback distribuídos adicionados;
- Compose `infrastructure` antigo removido;
- arquivos `.bak` e helper órfão removidos;
- exemplos Docker sincronizados com a versão atual;
- `set-version.mjs`, `check-version.mjs` e o validador Docker reforçados para
  interpolação `${TUNNARA_VERSION:-...}`;
- validador do repositório reforçado contra arquivos legados e Compose órfão;
- scripts Windows normalizados para CRLF.

## Validações aprovadas

- `npm run version:check`;
- `npm run version:test`;
- `npm run repository:check`;
- `npm run validate:node`;
- `npm run validate:shell`;
- `npm run validate:php`;
- `npm run validate:storage`;
- `npm run validate:release`;
- `npm run validate:sea`;
- `npm run validate:docker`;
- `npm run validate:mobile`;
- `npm run mobile:validate:scripts`;
- `npm run runtime:test`;
- `npm run sdk:c:test`;
- `npm run console:typecheck`;
- `npm run console:build`.

Resultados funcionais aprovados:

- HTTP e WebSocket;
- TCP e UDP;
- Cloudflare DNS;
- failover distribuído;
- WireGuard e redes privadas;
- Policy Engine e Request Inspector;
- SQLite, memory, PostgreSQL, MySQL e Redis;
- SDK C compartilhado e estático;
- build Vue/Vite.

## Testes negativos

A validação foi deliberadamente executada com regressões temporárias:

1. arquivo `.bak` — rejeitado;
2. `docker-compose.orphan-test.yml` — rejeitado;
3. fallback `${TUNNARA_VERSION:-2.0.0-rc.2}` — rejeitado.

Após cada teste, os arquivos temporários foram removidos e os validadores
voltaram a concluir com sucesso.

## Limites do ambiente

Não havia Docker Engine, Cargo/Rust, Composer ou Xcode instalados no ambiente
local. Portanto:

- `docker compose config` real será confirmado pelo runner Ubuntu do GitHub;
- builds Rust/Tauri serão confirmados pelos runners nativos;
- testes Laravel completos continuarão no job `Distributed Control API`;
- Android e iOS continuarão nos respectivos runners.

Esses jobs não foram apresentados como executados localmente.
