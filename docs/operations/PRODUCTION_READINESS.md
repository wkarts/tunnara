# Checklist de prontidão para produção

## Infraestrutura

1. PostgreSQL com backup testado, PITR quando disponível e volume separado.
2. Redis com autenticação, rede interna e política de persistência coerente com o uso.
3. Pelo menos dois Controls, dois Edges e dois Relays em hosts ou zonas independentes.
4. DNS de `control`, `console`, `relay` e wildcard validado antes de ativar ACME.
5. Portas 80/tcp, 443/tcp, 443/udp e 7443/udp liberadas; fallback TCP documentado.
6. NTP ativo em todos os nós; desvio de relógio afeta nonce, certificados e sessões.
7. Limites de arquivo, conexões e backlog revisados para a carga esperada.

## Segurança

- Tokens placeholders não são aceitos pelo bootstrap.
- API Token Cloudflare restrito à zona e permissões DNS necessárias.
- Segredos fora do repositório e com rotação documentada.
- Inspector desabilitado por padrão em dados sensíveis ou com redação/retensão aprovadas.
- Admin, service accounts e políticas revisados com menor privilégio.
- Imagens fixadas por versão ou digest em produção.

## Validação antes do go-live

```bash
cd deploy/docker
./tunnara.sh init
./tunnara.sh doctor
./tunnara.sh preflight-distributed-quic
./tunnara.sh up-distributed-quic
./tunnara.sh status-distributed-quic
./tunnara.sh backup-distributed
```

Execute também testes externos de HTTP, WebSocket, TCP, UDP e QUIC a partir de outra rede. A aprovação deve registrar evidências, versão, horário, responsáveis e plano de rollback.
