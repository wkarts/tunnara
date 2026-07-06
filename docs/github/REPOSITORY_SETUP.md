# Publicar a Tunnara no GitHub

```bash
gh auth login
./scripts/github/publish.sh SUA_ORGANIZACAO tunnara public
```

Ou, em repositório já criado:

```bash
./scripts/github/init-repository.sh git@github.com:SUA_ORGANIZACAO/tunnara.git
```

Após o push, configure secrets para assinatura Android/Apple e proteja `main`. O merge em `main` dispara o versionamento automático e a release coordenada; tags publicadas permanecem imutáveis.
