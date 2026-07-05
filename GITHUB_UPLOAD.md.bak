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
