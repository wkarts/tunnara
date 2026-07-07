# Tunnara Platform 2.0.0-rc.8 — upload idempotente e build iOS isolado

## Contexto

Após o merge da RC.7, dois jobs permaneceram quebrados:

1. o Runtime Linux compilou e gerou o pacote, mas o upload recebeu HTTP 422
   `ReleaseAsset.name already exists`;
2. o build iOS falhou no simulador ao ligar `libwg-go.a`, com os símbolos
   `_darwin_arm_init_mach_exception_handler` e
   `_darwin_arm_init_thread_exception_port` ausentes.

## Causas confirmadas

- O nome do asset já podia estar reservado por outro job ou reexecução antes de
  aparecer na listagem da API. O uploader apagava apenas assets já visíveis e
  encerrava após três tentativas curtas.
- O projeto forçava `GOOS_iphonesimulator := ios` e adicionava o bridge Go à
  extensão também no simulador. O runtime Go iOS não é o bridge correto para
  `iphonesimulator/arm64`.

## Alterações

- aceita asset completo já existente como sucesso idempotente;
- remove somente uploads `starter`, vazios ou explicitamente substituíveis;
- aguarda até 60 segundos por uploads concorrentes após HTTP 422;
- pagina assets explicitamente e mantém override para substituição forçada;
- adiciona testes de corrida, asset completo e asset incompleto;
- cria `TunnaraMobileSimulator` sem Packet Tunnel ou WireGuardGoBridge;
- mantém `TunnaraMobile` device com Packet Tunnel e WireGuard completos;
- remove a adaptação `GOOS_iphonesimulator := ios`;
- reforça validações mobile, nativas e de release;
- eleva a versão para `2.0.0-rc.8`.

## Resultado esperado

- reexecuções do Runtime Linux não falham por asset já concluído;
- uploads abandonados ainda são removidos e substituídos;
- o aplicativo de simulador compila sem ligar o runtime Go iOS;
- o IPA device continua sendo gerado com a extensão e o bridge reais;
- nenhuma parte já funcional de Android, Desktop, SDK ou Containers é alterada.

## Branch

`fix/v2.0.0-rc8-ios-runtime-idempotency`

## Commit

`fix(release): stabilize runtime uploads and isolate iOS simulator build`

## Título

`fix(release): corrigir upload Runtime e build iOS da Tunnara 2.0 RC`

## Squash/Merge

`fix: publish Tunnara 2.0.0-rc.8 with idempotent assets and isolated iOS simulator`
