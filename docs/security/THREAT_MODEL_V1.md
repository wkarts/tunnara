# Threat model — Tunnara 1.0.0

## Ativos

- tokens administrativos e de Agent;
- chaves Ed25519 e WireGuard;
- chave mestra de integrações;
- tokens Cloudflare;
- certificados TLS/QUIC;
- rotas e dados de auditoria.

## Fronteiras

- navegador/Console → Control API;
- Agent → Relay;
- Edge → Relay;
- nós distribuídos → Control API;
- Control API → Cloudflare;
- dispositivo → interface WireGuard.

## Controles

- TLS/QUIC, Ed25519, nonce e timestamp;
- token descartável e sessão revogável;
- hash de tokens e criptografia de segredos;
- scopes e organização obrigatória;
- cluster token separado;
- upstream loopback por padrão;
- API local limitada a loopback e token próprio;
- Caddy DNS-01 sem expor porta de challenge ao Agent.

## Riscos residuais

- um host Agent comprometido expõe sua chave e seus serviços locais;
- SQLite é adequado a instalação CE/single-host, não a active-active multi-host;
- mitigação volumétrica depende do provedor de rede/Cloudflare;
- assinatura de aplicativos depende das credenciais do publicador;
- DNS e emissão ACME dependem da disponibilidade de Cloudflare/Let’s Encrypt.
