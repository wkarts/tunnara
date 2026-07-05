# Correção aplicada aos logs do primeiro pull request

## Causas encontradas

1. Os dois `package-lock.json` continham URLs de um registry interno, indisponível nos runners do GitHub.
2. Os builds do SDK terminavam corretamente, mas falhavam ao enviar artifacts porque a cota temporária estava esgotada.
3. O job `macos-13/macOS x64` aguardava um runner que não deve mais fazer parte da matriz.
4. Scripts Android/iOS foram versionados sem permissão executável e eram chamados diretamente.
5. O CodeQL tentou enviar SARIF em um repositório privado sem Code Scanning disponível para aquele token/plano.
6. O Rust não estava formatado conforme `cargo fmt`.
7. O health check do PostgreSQL utilizava o usuário padrão do container em vez de `tunnara`.

## Resultado

- CI de pull request sem criação de artifacts;
- SDK C, runtime e mobile somente em tag ou execução manual;
- arquivos anexados diretamente à GitHub Release;
- nenhuma referência a `macos-13`;
- `npm ci` usando registry público, cache e retry;
- mobile PR limitado a sintaxe e sincronização de versão;
- CodeQL fora de pull requests e opt-in para repositórios privados;
- matriz SQLite/PostgreSQL/MySQL/Redis fora do caminho crítico do PR;
- workflow manual para liberar a cota já consumida.

## Ação única no repositório

Os artifacts antigos continuam ocupando a cota até serem removidos. Depois de enviar esta correção:

1. abra **Actions**;
2. execute **Clean Actions artifact storage** com `dry_run=true`;
3. confira a listagem;
4. execute novamente com `dry_run=false` e `older_than_days=0`.

O job antigo já enfileirado em `macos-13` pertence ao commit anterior. Cancele aquela execução uma única vez. Novos commits não criarão esse job.
