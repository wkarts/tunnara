# Resposta a incidentes

## Severidade

- **SEV-1:** vazamento cross-tenant, comprometimento de chave, indisponibilidade regional total.
- **SEV-2:** degradação ampla, falha de Relay/Edge sem recuperação automática, perda parcial de dados.
- **SEV-3:** impacto localizado, erro de integração ou regressão sem exposição de dados.

## Primeiros 15 minutos

1. Nomear responsável pelo incidente e canal de comunicação.
2. Preservar logs, métricas, versões, IDs de nós e linha do tempo.
3. Conter: revogar tokens/certificados, retirar nó, bloquear rota ou desabilitar Inspector.
4. Evitar apagar evidências ou executar migrações não planejadas.
5. Comunicar impacto conhecido sem especulação.

## Coleta mínima

- versão e digest das imagens;
- health e presença dos nós;
- métricas de conexões, latência e erros;
- auditoria de administração e revogação;
- estado PostgreSQL/Redis;
- mudanças de DNS/Cloudflare;
- IDs de organização/túnel anonimizados quando necessário.

Após recuperação, realizar postmortem sem culpabilização, ações corretivas com prazo e teste de não regressão.
