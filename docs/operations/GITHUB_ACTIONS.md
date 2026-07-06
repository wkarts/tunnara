# GitHub Actions

## Pull Requests

Executam validações rápidas e não geram artefatos de distribuição:

- integridade e sincronização de versão;
- testes do versionamento SemVer/prerelease;
- testes do runtime;
- typecheck e build do Console;
- validação Laravel;
- validação Docker;
- validação mobile somente de configuração.

Nenhum workflow de Pull Request usa `actions/upload-artifact`.

## Autoincremento após merge

O workflow `Version and release after merge` executa em cada push elegível na `main`.

Sem label:

- uma versão prerelease avança `rc.N`;
- uma versão estável avança o patch.

Labels disponíveis:

- `release:prerelease`
- `release:stable`
- `release:patch`
- `release:minor`
- `release:major`
- `release:none`

O job sincroniza todos os manifestos, valida as versões, cria um commit de preparação e dispara a release informando a versão e o SHA exato.

## Release coordenada

O workflow `Release after merge` aceita somente:

- `release_version`;
- `release_sha`.

O fluxo:

1. faz checkout do SHA informado;
2. confirma que `VERSION` corresponde à versão solicitada;
3. cria ou retoma uma única release draft;
4. compila Core, Runtime, SDK, Desktop, Mobile e Containers no mesmo commit;
5. envia arquivos diretamente à GitHub Release;
6. publica somente depois do sucesso integral.

Uma release publicada é imutável: não é reaberta e sua tag não é movida. Em caso de falha, a draft da mesma versão pode ser reexecutada.

## Runners macOS

- Apple Silicon: `macos-15`.
- Intel x64: `macos-15-intel`.
- `macos-13` não é utilizado.
