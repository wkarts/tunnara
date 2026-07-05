# Tunnara Mobile — Android

Aplicativo Android nativo para acesso às redes privadas Tunnara via `VpnService` e WireGuard userspace.

## Build sem credenciais de loja

O build não depende do Google Play nem de um keystore privado:

```bash
sdk/mobile/android/scripts/build-artifacts.sh
```

São produzidos:

- `debug-installable.apk`: assinado pela chave de debug do Android e instalável diretamente;
- `release-unsigned.apk`: release otimizado, preparado para assinatura posterior;
- `release-unsigned.aab`: bundle preparado para assinatura/publicação posterior.

## Build release assinado

Configure somente no ambiente seguro de build:

```bash
export TUNNARA_ANDROID_KEYSTORE=/caminho/tunnara-release.jks
export TUNNARA_ANDROID_STORE_PASSWORD='...'
export TUNNARA_ANDROID_KEY_ALIAS='tunnara'
export TUNNARA_ANDROID_KEY_PASSWORD='...'

sdk/mobile/android/scripts/build-artifacts.sh
```

Nesse modo, o script produz APK e AAB release assinados. A ausência total ou parcial dessas variáveis não interrompe o build: ele continua gerando os artefatos sem assinatura release e o APK debug instalável.

A publicação no Google Play é uma etapa separada e opcional no GitHub Actions.
