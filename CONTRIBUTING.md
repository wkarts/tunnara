# Contribuindo com o Tunnara

## Fluxo de branches

- `main`: versão estável e publicável.
- `next`: integração das próximas versões.
- `feature/<descricao>`: funcionalidades.
- `fix/<descricao>`: correções.
- `docs/<descricao>`: documentação.
- `release/<versao>`: preparação opcional de versão.

## Commits

O projeto usa Conventional Commits:

```text
feat(agent): adiciona reconexão exponencial
fix(console): corrige estado do menu lateral
docs(protocol): documenta handshake do relay
```

## Validação local

```bash
npm ci
npm --prefix apps/console ci
npm run validate
```

Com Rust, Composer e Docker disponíveis:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-features

cd apps/control-api
composer install
php artisan test

cd ../../deploy/docker
./tunnara.sh up
```

Mudanças no Visual Core devem preservar os temas, a organização de menus, a responsividade e o comportamento de workspace existentes.
