# Tunnara Mobile — iOS

Aplicativo SwiftUI com `NEPacketTunnelProvider` e WireGuardKit.

## Build sem Apple Developer

Em um runner macOS com Xcode e XcodeGen:

```bash
brew install xcodegen
sdk/mobile/ios/scripts/build-artifacts.sh
```

O processo sempre tenta gerar:

- aplicativo para iOS Simulator em ZIP;
- aplicativo `iphoneos` sem assinatura;
- `Tunnara-iOS-<versão>-unsigned.ipa` para armazenamento e assinatura posterior.

O IPA sem assinatura **não instala em iPhone/iPad comuns**. O iOS exige assinatura e provisionamento válidos para instalação em dispositivo físico. A ausência dessas credenciais não quebra o build sem publicação.

## IPA assinado, sem publicar na App Store

Configure os arquivos e valores no ambiente seguro:

```bash
export TUNNARA_APPLE_CERTIFICATE_P12=/segredos/distribution.p12
export TUNNARA_APPLE_CERTIFICATE_PASSWORD='...'
export TUNNARA_APPLE_APP_PROFILE=/segredos/app.mobileprovision
export TUNNARA_APPLE_PACKET_TUNNEL_PROFILE=/segredos/packet.mobileprovision
export TUNNARA_APPLE_TEAM_ID=ABCDE12345
export TUNNARA_IOS_EXPORT_METHOD=development # development, ad-hoc ou app-store-connect, conforme o Xcode

sdk/mobile/ios/scripts/build-artifacts.sh
```

O script importa temporariamente o certificado e os perfis, cria o `.xcarchive`, exporta o IPA assinado e remove o keychain temporário. Ele não publica nada automaticamente.

## Publicação opcional

A publicação em TestFlight/App Store Connect é uma etapa independente no GitHub Actions e somente é executada quando a variável de repositório e os secrets de publicação estiverem presentes.
