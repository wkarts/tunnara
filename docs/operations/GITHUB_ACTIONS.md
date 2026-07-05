# Política dos GitHub Actions

## Pull requests e commits

Os workflows executados em PR e push para `main`/`next` são apenas validações rápidas:

- `CI fast`;
- `Native fast checks`, somente quando Rust/PHP mudarem;
- `Mobile configuration validation`, somente quando mobile mudar.

Eles não compilam pacotes de distribuição e não usam `actions/upload-artifact`.

## Builds de distribuição

SDKs, runtimes, desktop, mobile e containers executam somente:

- em tags SemVer;
- manualmente por `workflow_dispatch`;
- no processo de release.

Os binários são anexados diretamente a uma GitHub Release. Isso evita consumir a cota do armazenamento temporário de artifacts durante validações.

## macOS

A matriz automática não utiliza `macos-13`. O SDK C usa apenas o runner macOS ainda ativo definido no workflow e não agenda o antigo job `macos-13/macOS x64`.

## Limpeza da cota existente

O workflow manual `Clean Actions artifact storage` permite listar ou remover artifacts antigos:

1. Abra **Actions**.
2. Selecione **Clean Actions artifact storage**.
3. Execute primeiro com `dry_run=true`.
4. Revise os itens.
5. Execute novamente com `dry_run=false`.

`older_than_days=0` remove todos os artifacts temporários armazenados. GitHub Releases e seus arquivos não são removidos.

## CodeQL em repositório privado

O CodeQL não é executado em pull requests. Em repositórios privados, ele só inicia quando a variável do repositório abaixo estiver habilitada:

```text
TUNNARA_ENABLE_CODEQL=true
```

Isso evita falha de upload SARIF quando o plano/permissão do repositório não disponibiliza Code Scanning.

## Matriz de bancos

O workflow `Storage compatibility matrix` valida semanalmente e sob demanda:

- SQLite + estado em memória;
- PostgreSQL + Redis;
- MySQL + Redis.

Ele não roda em pull requests e não produz artifacts.
