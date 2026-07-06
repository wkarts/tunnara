# Pull Request — Tunnara Platform 2.0.0-rc.4

## Branch

```text
fix/v2.0.0-rc4-legacy-compose-audit
```

## Commit

```text
fix(ci): integrate legacy QUIC compose and harden version validation
```

## Título

```text
fix(release): corrigir arquivos legados e validação Docker da Tunnara 2.0 RC
```

## Descrição

### Contexto

A validação do Pull Request falhou porque a cópia local continha um overlay
Docker distribuído QUIC de uma versão anterior. O arquivo ainda referenciava a
imagem `tunnara-quic-bridge:2.0.0-rc.2`, enquanto o projeto estava em
`2.0.0-rc.3`.

A auditoria foi executada sobre a cópia local realmente enviada ao GitHub, e
não apenas sobre o pacote oficial anteriormente fornecido.

### Causa raiz

- `deploy/docker/docker-compose.distributed.quic.yml` era um arquivo local extra;
- o arquivo não era referenciado por `tunnara.sh` nem validado como composição;
- a tag fixa antiga foi detectada por `version:check` e bloqueou corretamente a CI;
- os exemplos Compose local/VPS ainda tinham fallback `1.1.1`, mas a validação
  anterior não reconhecia versões dentro de `${TUNNARA_VERSION:-...}`.

### Alterações

- elevação para `2.0.0-rc.4`;
- integração oficial do perfil distribuído QUIC;
- comandos de preflight, start, update, status, logs e remoção;
- backup, restore e rollback PostgreSQL distribuídos;
- validação do Compose distribuído com overlay QUIC no PR;
- sincronização de tags fixas e fallbacks `TUNNARA_VERSION`;
- remoção do Compose `infrastructure` antigo;
- remoção de backups `.bak` e helper sem uso;
- detecção automática de Compose órfão e arquivos de backup;
- atualização das instruções operacionais;
- normalização dos scripts Windows conforme `.gitattributes`.

### Validações

- versionamento sincronizado em 25 pontos;
- build mobile `200007004`;
- testes SemVer;
- validações Node, Bash e PHP;
- storage e release pipeline;
- SEA preflight;
- Docker e mobile;
- runtime HTTP/WebSocket/TCP/UDP;
- Cloudflare, HA, WireGuard e redes privadas;
- Policy Engine e Request Inspector;
- SDK C;
- Console Vue/TypeScript e Vite;
- testes negativos contra legado, Compose órfão e fallback de versão antiga.

### Resultado

A correção elimina a causa exata do log anexado e impede que arquivos Docker ou
backups antigos voltem a passar silenciosamente pelo Pull Request.

## Squash and merge

```text
fix: publish Tunnara 2.0.0-rc.4 with audited Docker and immutable versioning
```
