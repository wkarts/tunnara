# Política dos GitHub Actions

## Pull requests

Os workflows de Pull Request são exclusivamente de validação:

- `CI fast`;
- `Native fast checks`, quando Rust/PHP mudarem;
- `Mobile configuration validation`, quando a configuração mobile mudar.

Eles não compilam pacotes de distribuição, não criam GitHub Releases e não usam `actions/upload-artifact` ou `actions/download-artifact`.

## Merge em `main`

O workflow `Release after merge` é o único fluxo automático iniciado por um merge em `main`.

Ele:

1. lê a versão do arquivo `VERSION`;
2. ignora a execução quando a release correspondente já existe;
3. repete as validações obrigatórias;
4. compila Console, Runtime Linux e SDK C;
5. gera os pacotes centrais;
6. cria e publica a GitHub Release;
7. envia os arquivos diretamente para a release;
8. dispara explicitamente os builds de Runtime, SDK, Desktop, Mobile e Docker.

O disparo explícito usa `workflow_dispatch`. Isso evita depender de eventos `push.tags` gerados pelo `GITHUB_TOKEN`, que não iniciam novas execuções de workflow.

## Builds de distribuição

Os workflows abaixo executam por chamada do release, tag criada externamente ou execução manual:

- `Runtime executables`;
- `SDK release builds`;
- `Desktop artifacts`;
- `Mobile release assets and optional stores`;
- `Publish container images`.

Os binários são anexados diretamente à GitHub Release. Não existe consumo do armazenamento temporário de Actions artifacts.

## Nova versão

Antes do merge:

```bash
npm run version:set -- 1.0.2
npm run version:check
```

Depois do merge, será criada a release `v1.0.2`.

## Rebuild da versão atual

Execute manualmente `Release after merge` com:

```text
force_rebuild=true
```

Os assets centrais são substituídos com `--clobber` e os builds de plataforma são disparados novamente.

## macOS

Nenhum workflow utiliza `macos-13`. As matrizes usam `macos-14` para os builds macOS configurados.

## Limpeza da cota antiga

O workflow manual `Clean Actions artifact storage` continua disponível somente para remover artifacts históricos criados por workflows anteriores:

1. Abra **Actions**.
2. Selecione **Clean Actions artifact storage**.
3. Execute com `dry_run=true`.
4. Revise os itens.
5. Execute com `dry_run=false`.

GitHub Releases e seus arquivos não são removidos.

## CodeQL

O CodeQL roda manualmente ou por agendamento. Em repositórios privados, exige:

```text
TUNNARA_ENABLE_CODEQL=true
```

## Matriz de bancos

O workflow `Storage compatibility matrix` roda semanalmente ou manualmente e cobre:

- SQLite + estado em memória;
- PostgreSQL + Redis;
- MySQL + Redis.

A chave Laravel de teste possui exatamente 32 bytes após a decodificação Base64.
