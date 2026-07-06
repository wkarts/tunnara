# Upgrade e rollback

## Regras

- Releases publicadas e tags são imutáveis.
- Nunca reutilize uma versão para corrigir pipeline ou binários.
- Faça backup antes de atualizar.
- Não misture versões incompatíveis de protocolo sem consultar as notas da release.

## Plano distribuído

```bash
cd deploy/docker
./tunnara.sh backup-distributed
./tunnara.sh update-distributed-quic
```

Rollback de imagens:

```bash
./tunnara.sh rollback-distributed-quic 2.0.0-rc.3
```

O rollback de imagem não desfaz automaticamente migrações destrutivas. Migrações da linha 2.0 devem ser aditivas/reversíveis; quando isso não for possível, restaure o dump correspondente:

```bash
./tunnara.sh restore-distributed backups/tunnara-postgres-AAAAmmdd-HHMMSS.dump --force
```

## Modo embedded

```bash
./tunnara.sh backup
./tunnara.sh update-production
./tunnara.sh restore backups/arquivo.sqlite
```

Após qualquer mudança valide health, criação de túnel, WebSocket, revogação e uma rota privada.
