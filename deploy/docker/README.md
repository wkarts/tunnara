# Tunnara em Docker

## Primeiro uso

Na raiz do repositório:

```bash
./docker.sh quickstart
```

Ou diretamente:

```bash
cd deploy/docker
./tunnara.sh quickstart
```

O arquivo `.env` é criado automaticamente. Ele não é versionado porque contém tokens e chaves.

## Modos de distribuição

```dotenv
TUNNARA_DEPLOY_MODE=image
```

Baixa imagens prontas do GHCR.

```dotenv
TUNNARA_DEPLOY_MODE=build
```

Constrói as imagens usando o código-fonte local.

Atalho:

```bash
./tunnara.sh quickstart-build
```

## Comandos essenciais

```bash
./tunnara.sh doctor
./tunnara.sh config
./tunnara.sh up
./tunnara.sh status
./tunnara.sh health
./tunnara.sh logs
./tunnara.sh urls
./tunnara.sh update
./tunnara.sh down
```

## Produção

```bash
./tunnara.sh init
# edite .env
./tunnara.sh preflight
./tunnara.sh up-production
```

## Instalação por release

O asset `Tunnara-Docker-vX.Y.Z.zip` contém somente os arquivos necessários ao Docker.

```bash
curl -fsSL https://raw.githubusercontent.com/wkarts/tunnara/main/deploy/docker/install-from-github.sh | sudo bash
```

Variáveis opcionais:

```bash
TUNNARA_VERSION=1.1.0
TUNNARA_INSTALL_DIR=/opt/tunnara
TUNNARA_START_MODE=image|build|production|none
GITHUB_TOKEN=token_para_repositorio_privado
```
