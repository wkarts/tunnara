# Protocolo de controle v0.1

Envelope JSON inicial:

```json
{"id":"uuid","correlation_id":null,"message":{"type":"heartbeat","payload":{"agent_id":"uuid","sequence":1}}}
```

O JSON será usado para desenvolvimento e diagnóstico. A evolução para Protobuf deve manter versionamento explícito e compatibilidade de pelo menos uma versão anterior. Credenciais de provisionamento são de uso único; sessões usam credenciais curtas e rotação.
