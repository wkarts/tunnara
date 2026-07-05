# Release CloudPanel/Linux sem instalador

Este release mantém a aplicação como está: frontend Vue/Vite + binário Rust/Tauri executando em modo headless/CLI/worker. No CloudPanel, o Node.js é usado apenas como launcher (`npm start`) para iniciar o binário Linux.

## Alvos oficiais Debian/Ubuntu

O build CloudPanel gera dois pacotes:

- `linux-x64`: `x86_64-unknown-linux-gnu`
- `linux-x86`: `i686-unknown-linux-gnu`

O pacote x64 é o alvo principal para servidores atuais. O pacote x86 é mantido para servidores 32 bits/legados e exige bibliotecas multiarch i386 no ambiente de build.

## Preparar ambiente Debian/Ubuntu

Em Debian 12, Ubuntu 22.04 ou Ubuntu 24.04:

```bash
bash scripts/linux/install-cloudpanel-build-deps.sh --all
```

Depois instale Node.js 22 e Rust, caso ainda não existam no ambiente.

## Gerar ambos os pacotes

```bash
npm run build:linux:cloudpanel
```

Saída:

```txt
release/cloudpanel/tunnara-console-cloudpanel-v1.1.14-linux-x64.tar.gz
release/cloudpanel/tunnara-console-cloudpanel-v1.1.14-linux-x64.tar.gz.sha256
release/cloudpanel/tunnara-console-cloudpanel-v1.1.14-linux-x86.tar.gz
release/cloudpanel/tunnara-console-cloudpanel-v1.1.14-linux-x86.tar.gz.sha256
```

## Gerar individualmente

```bash
npm run build:linux:cloudpanel:x64
npm run build:linux:cloudpanel:x86
```

## Gerar via Docker

```bash
npm run build:linux:cloudpanel:docker
```

O Docker usa Debian Bookworm como base de build, instala as dependências x64 e i386, compila o frontend, compila os binários e monta os `.tar.gz` finais.

## Deploy no CloudPanel

No servidor:

```bash
tar -xzf tunnara-console-cloudpanel-v1.1.14-linux-x64.tar.gz
cd tunnara-console-cloudpanel-v1.1.14-linux-x64
cp .env.example .env
chmod +x bin/tunnara_console *.sh
npm start
```

No template Node.js Application do CloudPanel, use:

```bash
npm start
```

O `server.mjs` lê `.env`, usa `PORT` do CloudPanel como WebPort quando disponível, inicia o binário em modo headless e mantém API/WebPort/serviços acessíveis conforme configuração.

## Execução direta por terminal

```bash
./start.sh
./status.sh
./logs.sh
./stop.sh
./restart.sh
```

CLI:

```bash
./cli.sh
```

Worker:

```bash
./worker.sh
```

Cron opcional:

```cron
* * * * * cd /caminho/do/app && ./check.sh >/dev/null 2>&1
```

## Observação sobre x86

O build x86 usa `i686-unknown-linux-gnu`. Em host x64, ele precisa de multiarch i386, incluindo `libwebkit2gtk-4.1-dev:i386`. Se a distribuição não fornecer essas bibliotecas, compile o x86 em um ambiente i386 dedicado ou use o pacote x64.
