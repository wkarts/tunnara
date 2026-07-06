# Tunnara Console

Base profissional e reutilizável para iniciar novas aplicações desktop corporativas com Tauri 2, Rust, Vue 3, TypeScript, SQLite, Pinia e Vue Router.

## Recursos principais

- Splash screen com progresso e timeout.
- Login local.
- Sessão persistente.
- Usuário master inicial `acesso pela Control API`.
- Empresas.
- Usuários.
- Perfis de acesso.
- Permissões.
- Licenciamento local/offline opcional.
- Logs da aplicação.
- Layout profissional e responsivo.
- Sidebar configurável.
- Módulos opcionais por configuração.
- Dashboard modelo reaproveitável.
- Branding personalizável.
- Estrutura preparada para API interna, integrações, serviço e modo headless.

## Documentação essencial

- [Primeiro uso para desenvolvedores](docs/FIRST_USE.md)
- [Guia para IA/agente de código](docs/AI_IMPLEMENTATION_GUIDE.md)
- [Branding](docs/BRANDING.md)
- [Bancos de dados](docs/DATABASES.md)
- [Migrations](docs/MIGRATIONS.md)
- [Modo headless](docs/HEADLESS_MODE.md)
- [Deploy em servidor](docs/SERVER_DEPLOYMENT.md)
- [Deploy em VPS](docs/VPS_DEPLOYMENT.md)
- [Serviço Windows](docs/WINDOWS_SERVICE.md)
- [Serviço Linux/systemd](docs/LINUX_SERVICE.md)


## Etapa 2.3

A versão 0.1.19 reforça o suporte multi-banco sem trocar o banco principal do desktop:

- SQLite continua sendo o banco funcional padrão do template.
- MySQL/MariaDB e PostgreSQL possuem health check e migrations por feature Rust.
- Firebird permanece fora do escopo funcional por compatibilidade.
- `/docs` e `/openapi.json` respeitam a segurança da API interna.
- Consulte `docs/ETAPA_2_3_MULTI_DB_HARDENING.md`.

## Desenvolvimento

```bash
npm install
npm run tauri:dev
```

## Build web

```bash
npm run typecheck
npm run build:web
```

## Build Tauri

```bash
npm run tauri:build
```

## Validação Rust

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --all-features
```

## Configuração central

A configuração de features, dashboard, banco, API interna, tray, sidebar e módulos opcionais fica em:

```text
src/config/projectConfig.ts
```

O menu fica em:

```text
src/config/navigation.ts
```

## Observação

Este projeto é um template. Regras de negócio específicas devem ser adicionadas como módulos do projeto derivado, sem poluir o core reutilizável.


## Etapa 2 funcional - 0.1.8

Implementações adicionadas nesta versão:

- API interna real em Rust com Axum: `/health`, `/version`, `/status`, `/app/meta`, `/features`, `/logs`, `/openapi.json` e `/docs`.
- Documentação Scalar em tema claro fixo.
- Modo runtime por argumentos: `--mode=desktop`, `--mode=headless-api`, `--mode=cli`, `--mode=worker`, `--host`, `--port`, `--database-driver`, `--data-dir`.
- Estrutura de CLI/headless sem abrir WebView.
- Camada de banco com SQLite funcional; MySQL/PostgreSQL com conexão real por feature Rust; Firebird ignorado nesta etapa por compatibilidade.
- Migrations centrais ampliadas: feature flags, integrações, logs de integração e tokens de API.
- Integrações externas funcionais: cadastro, token protegido, teste de conexão e logs.
- Tray Tauri 2 com restaurar, status e sair definitivamente.
- Comandos de serviço Windows executam `sc.exe` para instalar/controlar o executável atual em modo `--mode=headless-api`.
- Preview de impressão em janela própria.
- Dashboard com dados reais de logs, banco, API e integrações.

### Etapa 2.2 — multi-banco, API desktop controlável e serviços

Consulte [`docs/ETAPA_2_2_MULTI_DB_SERVICES_API.md`](docs/ETAPA_2_2_MULTI_DB_SERVICES_API.md).

Resumo:

- SQLite continua padrão.
- MySQL/MariaDB está disponível com `--features mysql-db`.
- PostgreSQL está disponível com `--features postgres-db`.
- Firebird foi ignorado nesta etapa por compatibilidade.
- API interna pode ser iniciada/parada pelo desktop.
- Serviço Windows usa `sc.exe`.
- Serviço Linux usa `systemd`.


## Etapa 2.4 - Rust CI e DatabaseProvider

Esta versão adiciona scripts locais para Rust (`fmt:rust`, `fmt:rust:check`, `lint:rust`, `test:rust`), reforça o workflow para impedir código fora de `rustfmt` e inicia a camada `DatabaseProvider` sem remover o CRUD SQLite antigo.

Documentação adicional:

- [Rust formatting e CI](docs/RUST_FORMATTING_AND_CI.md)
- [DatabaseProvider](docs/DATABASE_PROVIDER.md)

## Etapa 2.5 — DatabaseProvider CRUD multi-banco

A versão 0.1.19 inicia o CRUD genérico provider-based para SQLite, MySQL/MariaDB e PostgreSQL, preservando o CRUD antigo SQLite e mantendo Firebird fora do escopo funcional por compatibilidade. Consulte `docs/ETAPA_2_5_DATABASE_PROVIDER.md`.


## Validação rápida e CI

A validação de PR foi otimizada para separar `cargo fmt --check` das etapas mais pesadas de Rust/Tauri. Use também `docs/CI_PERFORMANCE.md`.

Comandos principais:

```bash
npm run fmt:rust
npm run fmt:rust:check
npm run validate:all
```

Para corrigir formatação Rust automaticamente:

```bash
./scripts/fix-rust-format.sh
```

No Windows PowerShell:

```powershell
./scripts/fix-rust-format.ps1
```

Hook local recomendado:

```bash
git config core.hooksPath .githooks
```

## Release da plataforma

O Console não publica releases de forma independente. O workflow raiz `Release after merge` coordena Console, Runtime, SDKs, Desktop, Mobile e Containers usando a versão definida no arquivo `VERSION`.

Consulte `../../docs/operations/RELEASE_PROCESS.md` e `docs/RELEASE_REPOSITORY.md`.
