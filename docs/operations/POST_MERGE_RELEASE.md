# Release após merge

A Tunnara separa validação de Pull Request e geração de binários.

## Pull Request

Os workflows de PR validam código, tipos, sintaxe e testes end-to-end, mas não usam o Actions Artifact Storage e não geram uma GitHub Release.

## Merge em `main`

O workflow `Release after merge` lê a versão do arquivo `VERSION`, gera os assets centrais e cria a release correspondente, como `v1.0.1`.

Em seguida, ele dispara explicitamente, por `workflow_dispatch`, os workflows de:

- runtimes Linux, Windows e macOS;
- SDK C multiplataforma;
- instaladores desktop;
- APK, AAB e IPA;
- containers GHCR.

Os arquivos são enviados diretamente para a GitHub Release. Nenhum desses fluxos depende do Actions Artifact Storage.

A chamada explícita é necessária porque tags ou releases criadas com o `GITHUB_TOKEN` não iniciam automaticamente novos workflows baseados em `push.tags`.

## Rebuild

Na aba **Actions**, execute **Release after merge** manualmente com `force_rebuild=true` para substituir os assets da versão presente no arquivo `VERSION`.

## Nova versão

Antes do merge, atualize a versão:

```bash
npm run version:set -- 1.0.2
npm run version:check
```

Depois do merge, o workflow criará `v1.0.2` e executará os builds de plataforma.
