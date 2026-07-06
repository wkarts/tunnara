# Pull Request — Tunnara Platform 2.0.0-rc.2

## Branch

```text
release/v2.0.0-rc2-production-hardening
```

## Commit principal

```text
feat: harden Tunnara 2.0.0 RC2 for production validation
```

## Título

```text
feat: concluir hardening operacional da Tunnara 2.0.0 RC2
```

## Contexto

A RC1 consolidou os recursos centrais da plataforma, porém ainda mantinha riscos operacionais no pipeline de release, empacotamento multiplataforma, geração mobile, drafts duplicados, uploads concorrentes, versionamento de pré-release e implantação distribuída com QUIC.

Este Pull Request entrega uma revisão única de hardening, sem apresentar a RC como GA antes da conclusão dos testes externos de escala, segurança e operação.

## Objetivos

- tornar o processo de release determinístico, imutável e repetível;
- impedir reutilização ou movimentação de tags já publicadas;
- impedir criação de drafts paralelos por jobs de plataforma;
- eliminar armazenamento temporário de artifacts em PRs;
- estabilizar builds Linux, Windows, macOS, Android e iOS;
- tornar o deploy distribuído explícito entre fallback TCP/TLS e QUIC;
- adicionar procedimentos reais de backup, restore, update e rollback;
- documentar claramente o runtime oficial e os gates necessários para GA.

## Alterações principais

### Release e GitHub Actions

- release única coordenada por `release_id`;
- checkout obrigatório da tag exata em todos os jobs;
- versão/tag publicadas são imutáveis;
- uploads sequenciais, idempotentes, com `--clobber` e retry;
- checksums e metadados exclusivos por componente e plataforma;
- prereleases não recebem a marcação `latest`;
- workflows de PR não criam artifacts;
- Runtime, SDK, Desktop, Mobile e Containers usam a mesma release draft;
- build SEA usa a API JavaScript do esbuild, evitando wrappers `.cmd` e execução incorreta do binário nativo;
- validação automática contra regressões do pipeline.

### Desktop e mobile

- Tauri recebe o `release_id` coordenado e não cria release paralela;
- assinatura/notarização Apple somente é habilitada quando todos os secrets necessários estão disponíveis;
- Android alinhado ao Kotlin integrado do AGP 9;
- AndroidX Core fixado em versão compatível com `compileSdk 35`;
- iOS com `Info.plist` gerado para o target principal;
- parser wg-quick local construído apenas sobre APIs públicas do WireGuardKit;
- patch idempotente para compatibilidade do WireGuardKit com Xcode 16;
- simulador iOS limitado a arm64 no runner Apple Silicon;
- build number mobile monotônico: `20000902` para `2.0.0-rc.2`;
- validações mobile continuam sem produzir artifacts em PR.

### Docker e operação

- perfil distribuído com PostgreSQL, Redis, dois Controls, dois Edges e dois Relays;
- fallback TCP/TLS documentado como caminho padrão do perfil distribuído;
- overlay `docker-compose.distributed.quic.yml` para QUIC/TLS 1.3 e UDP/7443;
- exportação controlada dos certificados gerenciados pelo Caddy para o QUIC Bridge;
- tokens placeholder não são mais aceitos pelo bootstrap;
- backup e restore PostgreSQL;
- update e rollback dos perfis distribuído e distribuído+QUIC;
- runbooks de readiness, atualização, disaster recovery e incidentes.

### Persistência e compatibilidade

- SQLite e memory permanecem no runtime embedded/single-node;
- PostgreSQL ou MySQL permanecem disponíveis no Control API distribuído;
- Redis permanece disponível para cache, sessão, presença, locks e filas;
- SQLite não é apresentado como banco compartilhável entre múltiplos Controls;
- não há migração destrutiva obrigatória nesta RC;
- OpenAPI e documentação foram versionadas para `2.0.0-rc.2`.

### Dependências

- Dependabot agrupado por ecossistema;
- limite de PRs simultâneos reduzido;
- upgrades major incompatíveis bloqueados para Pinia, Vue Router, TypeScript, Tauri/Rust e AndroidX Core enquanto os respectivos requisitos não forem migrados.

## Runtime oficial

Nesta RC, o caminho funcional oficial do plano de dados continua sendo o runtime Node.js 22. O workspace Rust e o QUIC Bridge são mantidos como evolução nativa e preview controlado. Agent/Edge/Relay Rust não são apresentados como substitutos completos até passarem pela mesma suíte E2E, carga e interoperabilidade.

## Critérios de aceite

- `VERSION` sincronizado em todos os pontos do monorepo;
- uma release draft por versão;
- tag publicada nunca reaberta ou movimentada;
- nenhum upload concorrente com nomes conflitantes;
- nenhum Actions Artifact criado em PR;
- builds de release fazem checkout da tag exata;
- Console passa em typecheck e build;
- SDK C gera bibliotecas estática e dinâmica;
- Server e Agent standalone Linux são gerados e executados;
- E2E standalone de HTTP/WebSocket aprovado;
- suítes HTTP/WebSocket, TCP/UDP, Cloudflare, failover, WireGuard, rede privada, Policy Engine e Inspector aprovadas;
- Docker, storage, release, mobile e arquivos de configuração aprovados pelos validadores;
- documentação de upgrade e rollback disponível.

## Testes executados

```text
REPOSITORY_OK
VERSION_OK (25 pontos; mobile build 20000902)
NODE_SYNTAX_OK
BASH_SYNTAX_OK
PHP_SYNTAX_OK
YAML_OK
STORAGE_PROFILES_OK
RELEASE_PIPELINE_OK
DOCKER_DEPLOYMENT_OK
MOBILE_CONFIG_OK
HTTP_WEBSOCKET_OK
TCP_UDP_OK
CLOUDFLARE_DNS_OK
DISTRIBUTED_FAILOVER_OK
WIREGUARD_OK
PRIVATE_NETWORK_OK
PRODUCTION_CONFIG_OK
POLICY_INSPECTOR_HA_OK
SECURITY_FUZZ_OK (3.000 iterações)
LOAD_OK (1.000 requests; concorrência 50; zero falhas)
SDK_C_OK
CONSOLE_TYPECHECK_OK
CONSOLE_BUILD_OK
STANDALONE_LINUX_OK
STANDALONE_E2E_OK
```

## Testes dependentes de infraestrutura externa

Permanecem obrigatórios antes da GA:

- Docker/Helm em cluster real;
- imagens OCI amd64/arm64;
- builds nativos Windows/macOS/Android/iOS nos runners oficiais;
- Cloudflare, ACME e QUIC em domínio/IP real;
- assinatura e notarização;
- dispositivos físicos;
- soak, caos, carga dedicada, pentest e auditoria externa.

## Migrações

Não existem migrações destrutivas obrigatórias nesta entrega. Instalações existentes devem:

1. executar backup antes da atualização;
2. atualizar imagens/binários para `2.0.0-rc.2`;
3. executar migrações Laravel quando aplicável;
4. validar health checks, Agents, rotas e certificados;
5. manter a versão anterior disponível para rollback.

## Compatibilidade

- compatibilidade funcional com as categorias de recursos de ngrok e Pangolin;
- sem compatibilidade binária ou de protocolo com agentes proprietários de terceiros;
- runtime embedded preservado;
- Control API PostgreSQL/MySQL/Redis preservado;
- configurações da RC1 devem ser revisadas contra os novos exemplos e runbooks.

## Rollback

Use os procedimentos de `docs/operations/UPGRADE_ROLLBACK.md` e o backup preventivo. Exemplo:

```bash
cd deploy/docker
./tunnara.sh rollback-distributed-quic 2.0.0-rc.1
```

Em caso de restore do PostgreSQL, execute em janela de manutenção e valide o plano de controle antes de liberar tráfego.

## Classificação

Esta entrega é uma Release Candidate pronta para GitHub, homologação e produção controlada. A promoção para GA depende da aprovação dos gates documentados em `docs/security/MATURITY_GATES.md`.

## Squash and merge

```text
feat: release Tunnara Platform v2.0.0-rc.2
```
