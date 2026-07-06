# Changelog

## [2.0.0-rc.4] - 2026-07-06

### Correção da validação pós-merge

- Identificado arquivo legado `deploy/docker/docker-compose.distributed.quic.yml` mantido fora do pacote oficial da RC.3 e ainda fixado em `2.0.0-rc.2`.
- Corrigida a divergência que interrompia `npm run version:check` no job `Core and runtime`.
- O overlay distribuído QUIC passou a ser oficialmente integrado ao launcher `deploy/docker/tunnara.sh` e à validação Docker.
- O perfil distribuído sem overlay anuncia Relay TCP; o perfil `distributed-quic` sobrescreve a descoberta para QUIC de forma explícita.

### Limpeza de legado

- Removidos arquivos `.bak` antigos que continham documentação e manifests de versões anteriores.
- Removido helper `scripts/ci/base64-decode.sh` sem qualquer referência nos workflows atuais.
- Normalizados scripts Windows conforme `.gitattributes`, mantendo CRLF para `.bat`, `.cmd` e `.ps1`.
- O validador do repositório agora rejeita `.bak`, `.orig`, `.rej` e Compose não integrado ao launcher.

### Operação distribuída

- Adicionados comandos `preflight-distributed-quic`, `up-distributed-quic`, `update-distributed-quic`, `status-distributed-quic` e equivalentes de logs/remoção.
- Adicionados backup e restore PostgreSQL distribuído com confirmação destrutiva.
- Adicionados rollback de imagens para o perfil distribuído com e sem QUIC.
- A CI valida também a composição combinada `docker-compose.distributed.yml + docker-compose.distributed.quic.yml`.

### Versionamento

- Versão elevada para `2.0.0-rc.4`.
- Build mobile sincronizado: `200007004`.
- O fluxo pós-merge preserva `2.0.0-rc.4` quando a última versão reservada é `2.0.0-rc.3`, evitando salto indevido para `rc.5`.

## [2.0.0-rc.3] - 2026-07-06

### Correção do build pós-merge

- Corrigido o empacotamento SEA de Agent e Server no job `Build and upload core assets`.
- O `esbuild` deixou de ser executado como se o binário ELF/PE fosse um arquivo JavaScript.
- O bundler agora utiliza diretamente a API JavaScript oficial `esbuild.build()`, de forma portável em Linux, Windows e macOS.
- A execução do `postject` permanece pelo CLI JavaScript via Node, que é o caminho correto para a injeção do blob SEA.
- Adicionado tratamento explícito para falhas de inicialização de processos e códigos de saída desconhecidos.

### Proteção contra regressão

- Adicionado `npm run validate:sea`, que compila em memória as entradas do Agent e Server sem persistir artefatos.
- O CI rápido de Pull Request agora executa o preflight do bundler SEA.
- O validador de release rejeita novamente qualquer tentativa de executar `node_modules/esbuild/bin/esbuild` por `node`.
- A versão foi elevada para `2.0.0-rc.3`, preservando a imutabilidade da release e da tag `v2.0.0-rc.2`.
- Build mobile sincronizado: `200007003`.

### Validação

- Executáveis SEA Linux x64 de Agent e Server gerados com sucesso.
- Smoke test de versão aprovado nos dois executáveis.
- Suite funcional, SDK C, Console Vue/TypeScript, SemVer, storage, Docker, mobile e pipeline de release aprovados.

## [2.0.0-rc.2] - 2026-07-06

### Correções de validação

- Adicionado `esbuild` como dependência explícita do Console Vue, eliminando a falha do Vite 8 em instalações limpas.
- Corrigida a validação iOS para usar `MARKETING_VERSION` numérica (`2.0.0`) enquanto a versão distribuída permanece `2.0.0-rc.2`.
- Adicionada validação consistente de `versionCode`, `CURRENT_PROJECT_VERSION` e `CFBundleVersion`.
- Removido o cache Composer apontando para um diretório inexistente no GitHub Actions.

### Autoincremento e releases imutáveis

- Implementado versionamento SemVer com suporte a prereleases (`rc.1` → `rc.2` → `rc.3`).
- Adicionados modos `auto`, `prerelease`, `stable`, `patch`, `minor` e `major`.
- Incluídos labels `release:prerelease`, `release:stable` e `release:none`.
- Corrigido o dispatch entre os workflows de versionamento e release.
- Cada release passa a compilar um commit imutável informado por SHA.
- Releases publicadas não são reabertas e tags publicadas não são movimentadas.
- Drafts interrompidas podem ser retomadas de modo idempotente.

### Mobile

- Novo build number monotônico por canal: prereleases, versão estável e patch seguinte preservam ordem crescente para Android e iOS.
- Android migrado para o Kotlin integrado do AGP 9.2.1, sem o plugin legado `org.jetbrains.kotlin.android`.
- `androidx.core:core-ktx` fixado em `1.16.0` para permanecer compatível com `compileSdk 35`.
- iOS passa a gerar explicitamente o `Info.plist` do aplicativo principal e valida o bundle antes de empacotar a extensão.
- Preparação idempotente do WireGuardKit para Xcode 16, simulador arm64 e tipos C padronizados.
- Metadados e checksums Android/iOS agora possuem nomes exclusivos para impedir colisões na mesma release.
- Build mobile desta versão: `200007002`.

### Pipeline multiplataforma

- O build SEA executa `esbuild` e `postject` pelos CLIs JavaScript via Node, incluindo Windows sem dependência de wrappers `.cmd`.
- Uploads de Runtime, SDK, Android, iOS e Core usam um uploader sequencial, idempotente, com `--clobber` e tentativas controladas.
- O uploader é compatível com o Bash 3.2 do macOS e não depende de `mapfile`, `sort -z` ou GNU coreutils.
- O Tauri recebe o `releaseId` da única draft coordenada e não cria releases paralelas.
- Tags existentes também participam do cálculo da próxima versão, impedindo colisões mesmo quando uma tag não possui release publicada.
- Imagens prerelease publicam o canal `rc` sem sobrescrever `latest` ou a tag estável de série.
- Dependabot foi agrupado e limitado para reduzir PRs incompatíveis e evitar majors automáticos no Console e mobile.

## [2.0.0-rc.1] - 2026-07-06

### Plano de controle distribuído

- Adicionado perfil Laravel com PostgreSQL ou MySQL como fonte persistente e Redis para cache, sessões e filas.
- Adicionados provisionamento descartável, sessões de Agent, autenticação Ed25519, nonce, presença, nodes, rotas internas e atualização de saúde de targets.
- Adicionadas duas instâncias Control, dois Edges e dois Relays no Compose distribuído, com balanceamento interno pelo Caddy.
- Mantido o runtime embedded SQLite/memory para Community single-node.

### Policy Engine e identidade no Edge

- Adicionados matchers por método, caminho, regex, host, CIDR e headers.
- Adicionadas ações allow, deny, redirect, rate limit, Basic Auth, API key, JWT/OIDC, rewrite e transformação de headers.
- Adicionadas validações defensivas, limites estruturais e proteção contra expressões regulares arriscadas.
- Adicionado fuzzing automatizado do Policy Engine.

### Request Inspector

- Captura opcional de requests e responses por túnel.
- Redação automática de Authorization, cookies e campos sensíveis.
- Limites de body, retenção e quantidade máxima de registros.
- Replay controlado de requisições preservando método, path e headers permitidos.
- Interface administrativa no Console.

### Roteamento e resiliência

- Múltiplos targets por túnel.
- Prioridade, peso, health checks, limiares de falha/recuperação e failover.
- Métricas por túnel, target, política e status.
- Manutenção automática de auditoria e inspeções.

### Observabilidade e operação

- Endpoint Prometheus.
- Stack Prometheus/Grafana e dashboard inicial.
- Helm Chart com HPA, PDB, NetworkPolicy, ServiceMonitor, PVC, Ingress e Secrets.
- OpenAPI da série 2.0.
- Workflows noturnos de fuzzing e carga sem geração de artefatos.

### Console e SDKs

- Páginas funcionais para Policies e Request Inspector.
- Túneis com seleção de política, Inspector, targets e saúde.
- SDK C ABI e runtime standalone Linux recompilados para a versão RC.

### Validação

- Suite funcional HTTP/WebSocket/TCP/UDP, Cloudflare, failover distribuído, WireGuard, redes privadas e Policy Engine aprovada.
- 3.000 iterações de fuzzing sem falhas não tratadas.
- Benchmark local: 1.000 requests, concorrência 50, zero falhas, aproximadamente 548,87 req/s e p95 de 107,81 ms no ambiente de validação.
- E2E HTTP/WebSocket aprovado também contra executáveis standalone Linux.

### Classificação

A versão é um Release Candidate para homologação e produção controlada. A promoção para GA depende de testes multi-host prolongados, domínio real, dispositivos físicos e auditoria externa documentados em `docs/security/MATURITY_GATES.md`.

## [1.1.1] - 2026-07-05

- Adicionados exemplos Docker Compose explícitos para ambiente local e VPS.
- Adicionado exemplo de VPS com Cloudflare, Let's Encrypt, HTTP/3 e Relay QUIC.
- Adicionados modelos de ambiente separados para local e VPS.
- Adicionado guia operacional passo a passo para Docker em VPS.
- Documentada a separação entre runtime SQLite/memory e Control API PostgreSQL/MySQL/Redis.

## [1.1.0] - 2026-07-05

- Docker Community e produção, releases coordenadas, GHCR e otimizações do Console.
- Providers SQLite, PostgreSQL, MySQL e Redis documentados e validados.

## [1.0.1] - 2026-07-05

- Builds mobile independentes da publicação nas lojas.
- Correções de CI, assinatura opcional e sincronização de versões mobile.

## [1.0.0] - 2026-07-05

- HTTP/HTTPS/WebSocket/TCP/UDP, Cloudflare, ACME, QUIC Bridge, WireGuard, SDKs e distribuição inicial.

## [0.2.1] - 2026-07-05

- Primeiro vertical slice HTTP/WebSocket e preparação GitHub-ready.
