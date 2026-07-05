# Tunnara Console - Release CloudPanel/Linux sem instalador

Pacote compatível com Debian/Ubuntu, gerado em duas arquiteturas quando o build é executado com `--all`:

- `linux-x64`: servidores 64 bits atuais.
- `linux-x86`: servidores 32 bits/legados.


Este pacote é para servidor Linux, CloudPanel, CLI e navegador. Ele não abre desktop/Tauri window.

## Uso no CloudPanel como Node.js Application

1. Envie/descompacte este diretório no servidor.
2. Copie `.env.example` para `.env`.
3. Confirme permissão do binário:
   ```bash
   chmod +x bin/tunnara_console *.sh
   ```
4. No CloudPanel, use:
   ```bash
   npm start
   ```
5. A porta pública local será a variável `PORT` do CloudPanel. O launcher repassa essa porta para o WebPort Rust.

## Uso direto por terminal Linux

```bash
cp .env.example .env
chmod +x bin/tunnara_console *.sh
./start.sh
./status.sh
./logs.sh
```

Parar/reiniciar:

```bash
./stop.sh
./restart.sh
```

CLI:

```bash
./cli.sh
```

Cron opcional para checagem:

```cron
* * * * * cd /caminho/do/app && ./check.sh >/dev/null 2>&1
```

## Portas padrão

- API interna: `127.0.0.1:61001`
- Web/browser: `127.0.0.1:61002` ou `PORT` do CloudPanel
- Webhook: `127.0.0.1:61003` quando habilitado
- WebSocket: `127.0.0.1:61004` quando habilitado

## Segurança

Por padrão, os serviços ficam em loopback. Exponha publicamente via CloudPanel/Nginx e habilite tokens quando usar API/Webhook/WebSocket fora do localhost.
