# Threat model inicial

Ativos: chaves de dispositivos, tokens, domínios, streams, metadados de sessão e dados de auditoria.

Controles obrigatórios: mTLS, TLS 1.3, rotação, proteção contra replay, isolamento por organização, validação de destinos, bloqueio de metadata endpoints, limites de conexão/banda, revogação, logs sem segredos, assinatura dos artefatos e SBOM.

O edge nunca deve permitir que um tenant resolva ou encaminhe recursos de outro tenant. O agente deve bloquear destinos não configurados e não aceitar comandos administrativos fora do canal autenticado.
