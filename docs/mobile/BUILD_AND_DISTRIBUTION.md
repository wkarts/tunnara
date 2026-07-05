# Builds mobile independentes das lojas

A Tunnara separa **compilação**, **assinatura** e **publicação**. Nenhuma credencial de loja é necessária para validar o código e gerar os artefatos básicos.

## Matriz de saída

| Plataforma | Sem secrets | Com secrets de assinatura | Com publicação habilitada |
|---|---|---|---|
| Android | APK debug instalável, APK release sem assinatura e AAB sem assinatura | APK e AAB release assinados | envio opcional ao Google Play |
| iOS | app de Simulator e IPA `iphoneos` sem assinatura | IPA development/ad-hoc/App Store assinado | envio opcional ao TestFlight |

> O IPA sem assinatura é um artefato para CI, auditoria e assinatura posterior. Ele não instala em um iPhone/iPad comum sem assinatura e perfil de provisionamento válidos.

## GitHub Actions

### Build contínuo

`.github/workflows/mobile.yml` sempre compila sem credenciais de publicação.

### Release mobile

`.github/workflows/mobile-release.yml` sempre gera os artefatos e, quando houver secrets, também gera variantes assinadas. A publicação é controlada separadamente.

## Secrets Android opcionais

```text
TUNNARA_ANDROID_KEYSTORE_BASE64
TUNNARA_ANDROID_STORE_PASSWORD
TUNNARA_ANDROID_KEY_ALIAS
TUNNARA_ANDROID_KEY_PASSWORD
```

Para publicação:

```text
TUNNARA_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

Variáveis do repositório:

```text
TUNNARA_ENABLE_GOOGLE_PLAY_PUBLISH=true|false
TUNNARA_GOOGLE_PLAY_TRACK=internal|alpha|beta|production
```

## Secrets Apple opcionais

```text
TUNNARA_APPLE_CERTIFICATE_BASE64
TUNNARA_APPLE_CERTIFICATE_PASSWORD
TUNNARA_APPLE_APP_PROFILE_BASE64
TUNNARA_APPLE_PACKET_TUNNEL_PROFILE_BASE64
TUNNARA_APPLE_TEAM_ID
```

Para publicação:

```text
TUNNARA_APPSTORE_ISSUER_ID
TUNNARA_APPSTORE_API_KEY_ID
TUNNARA_APPSTORE_API_PRIVATE_KEY
```

Variável do repositório:

```text
TUNNARA_ENABLE_APPSTORE_PUBLISH=true|false
```

## Comportamento na ausência de secrets

- nenhum job de build é ignorado;
- nenhum job de build falha apenas porque uma credencial não foi configurada;
- etapas de assinatura são ignoradas;
- etapas de publicação são ignoradas com um aviso;
- APK, AAB, IPA sem assinatura e aplicativo de simulador continuam armazenados como artefatos do workflow.

## Segurança

Nunca armazene `.jks`, `.p12`, `.mobileprovision`, chaves `.p8` ou senhas no repositório. Use GitHub Actions Secrets ou um cofre externo.
