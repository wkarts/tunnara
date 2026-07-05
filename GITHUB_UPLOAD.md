# Upload da Tunnara 1.0.1 ao GitHub

## Script automático

```bash
gh auth login
./scripts/github/publish.sh SUA_ORGANIZACAO tunnara public
```

## Git bundle

```bash
git clone Tunnara-Platform-v1.0.1-Git-Repository.bundle tunnara
cd tunnara
git remote set-url origin git@github.com:SUA_ORGANIZACAO/tunnara.git
git push -u origin main
git push origin v1.0.1
```

## Builds mobile sem publicação

Após o push, execute `Mobile build validation` ou `Mobile artifacts and optional store publication`. Sem secrets, os workflows geram APK/AAB Android e IPA iOS sem tentar publicar.

## Secrets opcionais Android

- `TUNNARA_ANDROID_KEYSTORE_BASE64`
- `TUNNARA_ANDROID_STORE_PASSWORD`
- `TUNNARA_ANDROID_KEY_ALIAS`
- `TUNNARA_ANDROID_KEY_PASSWORD`
- `TUNNARA_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — somente publicação

Variáveis:

- `TUNNARA_ENABLE_GOOGLE_PLAY_PUBLISH=true|false`
- `TUNNARA_GOOGLE_PLAY_TRACK=internal|alpha|beta|production`

## Secrets opcionais Apple

- `TUNNARA_APPLE_CERTIFICATE_BASE64`
- `TUNNARA_APPLE_CERTIFICATE_PASSWORD`
- `TUNNARA_APPLE_APP_PROFILE_BASE64`
- `TUNNARA_APPLE_PACKET_TUNNEL_PROFILE_BASE64`
- `TUNNARA_APPLE_TEAM_ID`
- `TUNNARA_APPSTORE_ISSUER_ID` — somente publicação
- `TUNNARA_APPSTORE_API_KEY_ID` — somente publicação
- `TUNNARA_APPSTORE_API_PRIVATE_KEY` — somente publicação

Variável:

- `TUNNARA_ENABLE_APPSTORE_PUBLISH=true|false`

Não configure as variáveis de publicação até desejar enviar builds às lojas. A assinatura pode ser usada para gerar IPA/APK instaláveis sem publicar.

## Cloudflare e produção

Configure tokens e domínios no `.env` do servidor ou em secret manager. Nunca armazene segredos de Cloudflare, certificados ou perfis mobile no repositório.

# Aplicação da correção no Pull Request inicial

Branch já existente:

```text
release/v1.0.1-initial-platform
```

## Opção 1 — substituir pelo pacote GitHub Ready

Extraia `Tunnara-Platform-v1.0.1-CI-Storage-Fix-GitHub-Ready.zip` sobre o clone local, preservando a pasta `.git`, e execute:

```bash
git add --all
git commit -m "fix: stabilize CI and restore configurable storage providers"
git push origin release/v1.0.1-initial-platform
```

## Opção 2 — aplicar o patch

Na raiz do clone:

```bash
git apply --index Tunnara-Platform-v1.0.1-CI-Storage-Fix.patch
git commit -m "fix: stabilize CI and restore configurable storage providers"
git push origin release/v1.0.1-initial-platform
```

## Depois do push

- cancele a execução antiga que ficou aguardando `macos-13`;
- execute uma vez o workflow `Clean Actions artifact storage` para liberar a cota antiga;
- o novo PR deve iniciar apenas os checks rápidos aplicáveis às mudanças.

Consulte:

```text
docs/operations/CI_STORAGE_FIX.md
docs/operations/GITHUB_ACTIONS.md
docs/operations/STORAGE_PROVIDERS.md
```

# Aplicação da correção pós-merge

A correção deve ser enviada por um novo Pull Request criado a partir da `main` atual.

## Branch

```text
fix/v1.0.1-post-merge-release-pipeline
```

## Aplicar o patch

```bash
git checkout main
git pull --rebase origin main
git switch -c fix/v1.0.1-post-merge-release-pipeline

git apply --check Tunnara-Platform-v1.0.1-Post-Merge-Release-Fix.patch
git apply --index Tunnara-Platform-v1.0.1-Post-Merge-Release-Fix.patch

git commit -m "fix: generate release assets after merge"
git push -u origin fix/v1.0.1-post-merge-release-pipeline
```

## Resultado esperado após o merge

O workflow `Release after merge` deve:

1. criar `v1.0.1` usando a versão do arquivo `VERSION`;
2. gerar e anexar os pacotes centrais;
3. disparar Runtime, SDK, Desktop, Mobile e Docker por `workflow_dispatch`;
4. não utilizar Actions Artifact Storage;
5. não executar `macos-13`;
6. não depender de um evento de tag criado pelo próprio `GITHUB_TOKEN`.

Caso a release `v1.0.1` já exista parcialmente, execute manualmente o workflow com `force_rebuild=true`.
