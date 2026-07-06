# Release e repositório GitHub

O Console faz parte da release unificada da Tunnara e não executa um release próprio.

A publicação é coordenada pelo workflow raiz:

```text
.github/workflows/release.yml
```

A versão vem do arquivo `VERSION`. Quando esse arquivo muda em `main`, o fluxo cria ou retoma uma GitHub Release em draft, compila todos os componentes e somente publica a release depois do sucesso dos builds obrigatórios.

Para repositórios derivados, ajuste as imagens e o instalador em:

```text
deploy/docker/.env.example
deploy/docker/install-from-github.sh
```

O workflow utiliza `GITHUB_REPOSITORY` e `GITHUB_REPOSITORY_OWNER`; não existe URL fixa de release no Console.
