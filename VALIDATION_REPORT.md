# Tunnara Platform 2.0.0-rc.8 — relatório de validação

## Falhas confirmadas na RC.7

### Runtime Linux

- Agent, Server e QUIC Bridge foram compilados e aprovados no smoke test.
- `SHA256SUMS-runtime-linux-x64.txt` foi enviado normalmente.
- O pacote `Tunnara-Runtime-linux-x64-v2.0.0-rc.7.tar.gz` recebeu HTTP 422
  `already_exists` em três tentativas.
- A causa é uma corrida de publicação: o nome pode estar reservado por outro
  upload antes de o asset aparecer na listagem da release.

### iOS

- XcodeGen, SwiftPM, WireGuardKit e o bridge Go foram preparados corretamente.
- O parser wg-quick compilou, eliminando a falha anterior de initializer.
- O link do Packet Tunnel para `iphonesimulator/arm64` falhou porque o projeto
  ligava `libwg-go.a` construído como runtime iOS no simulador.
- Os símbolos ausentes foram
  `_darwin_arm_init_mach_exception_handler` e
  `_darwin_arm_init_thread_exception_port`.

## Correções

- uploads completos existentes passam a ser aceitos como sucesso idempotente;
- uploads `starter` ou com tamanho zero são removidos;
- HTTP 422 inicia polling do asset concorrente por até 60 segundos;
- paginação de assets é explícita;
- substituição forçada continua disponível por variável de ambiente;
- simulador usa alvo isolado sem Packet Tunnel e sem bridge Go;
- device/IPA mantém Packet Tunnel, WireGuardKit e WireGuardGoBridgeiOS;
- removido `GOOS_iphonesimulator := ios` da preparação do pacote.

## Validações executadas

- versão sincronizada em 26 pontos: `2.0.0-rc.8`;
- build Android/iOS: `200007008`;
- versão MSI: `2.0.0-7008`;
- testes SemVer/MSI: 6/6;
- testes do uploader: 4/4;
- sintaxe Node.js, Bash e PHP;
- repository, storage, release, Docker, mobile, dependências nativas e SEA;
- Runtime E2E: HTTP/WebSocket, TCP/UDP, Cloudflare, HA, WireGuard, rede privada,
  produção e Policy Engine;
- SDK C compartilhado, estático e exemplo de versão;
- Console Vue: typecheck e build Vite com 179 módulos;
- build SEA Linux x64 do Agent e Server;
- aplicação limpa do patch sobre a RC.7;
- integridade e SHA-256 dos pacotes gerados.

## Limites do ambiente

O ambiente local não possui Xcode, Android SDK, Docker Engine ou Cargo/Rust.
Portanto, o build final do IPA, MSI e containers multi-arquitetura permanece a
cargo dos runners nativos. A correção iOS isola exatamente a etapa de simulador
que falhou, sem modificar o alvo device que gera o IPA.
