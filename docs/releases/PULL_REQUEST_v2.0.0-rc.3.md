# Tunnara Platform 2.0.0-rc.3 — Correção do build SEA pós-merge

## Contexto

O workflow coordenado criou corretamente a draft da RC.2, mas o job `Build and upload core assets` falhou ao tentar executar o binário nativo do esbuild através do interpretador Node.js.

## Alterações

- Substitui a execução incorreta do binário `esbuild` pela API JavaScript `esbuild.build()`.
- Mantém o `postject` no CLI JavaScript suportado.
- Adiciona mensagens de erro de processo mais precisas.
- Cria o preflight real `validate:sea` para Agent e Server.
- Executa o preflight no CI rápido de Pull Request.
- Reforça o validador do pipeline contra regressão.
- Eleva a versão para `2.0.0-rc.3` sem alterar releases ou tags publicadas.

## Validações

- Versionamento sincronizado em 25 pontos.
- Build mobile `200007003`.
- Bundle SEA em memória para Agent e Server.
- Executáveis SEA Linux x64 gerados e executados.
- Pipeline de release, storage, Docker, mobile, Runtime E2E, SDK C e Console aprovados.

## Resultado

O Core volta a gerar e anexar seus artefatos, liberando a execução dos demais grupos do workflow coordenado de release.
