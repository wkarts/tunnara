# Lacunas para paridade com ngrok e Pangolin

## Estado atual

A Tunnara possui um runtime de referência que cobre túneis HTTP/WebSocket, TCP/UDP, Agent, Relay, Edge, integração Cloudflare, ACME/Caddy, QUIC bridge, redes privadas e uma base de Console/SDKs.

Isso demonstra a arquitetura e permite implantações iniciais, mas ainda não equivale à maturidade operacional, segurança, experiência de usuário e ecossistema de ngrok ou Pangolin.

## Prioridade P0 — produção segura e distribuída

- Unificar o Control API distribuído com o data plane; hoje o runtime Node usa SQLite/memory e o Laravel/PostgreSQL/MySQL/Redis permanece um plano modular separado.
- Remover SQLite do caminho de HA real e implementar estado compartilhado, leases, locks, eleição e reconciliação.
- Implementar RBAC/ABAC completo, organizações, usuários, equipes, convites e isolamento multi-tenant testado.
- Implementar OIDC/OAuth2, SAML, MFA e gestão/revogação de sessões de usuários.
- Criar policy engine no Edge para autenticação, IP/CIDR, rate limit, headers, redirects, rewrites e regras por request/response.
- Hardening criptográfico, rotação automatizada, CA interna, mTLS e storage seguro de chaves.
- Testes de carga, soak, caos, NAT real, perda de pacotes, MTU, reconexão e failover entre regiões.
- Observabilidade de produção: métricas, tracing, logs estruturados, cardinalidade controlada, alertas e dashboards.

## Prioridade P1 — paridade funcional

- NAT traversal direto entre clientes/sites com STUN/ICE-like discovery e relay apenas como fallback.
- Clientes desktop e mobile totalmente funcionais e testados em hardware real.
- Recursos de acesso privado por usuário, máquina, papel e política com deny-by-default.
- DNS privado, split DNS, rotas sobrepostas, subnet routers e conflito de CIDR.
- Browser-based SSH/RDP/VNC e gateways específicos de protocolo.
- TLS passthrough, SNI routing, gRPC streaming, HTTP/2 e HTTP/3 completos.
- Pooling/load balancing entre múltiplos Agents e targets com health checks ativos.
- Domínios customizados com verificação de propriedade e múltiplos providers DNS.
- Atualização assinada e rollback coordenado para Agent, Edge, Relay e Console.
- Migrações compatíveis entre versões e política formal de compatibilidade de protocolo.

## Prioridade P2 — ecossistema e operação

- Kubernetes Operator, Helm chart, Ingress e Gateway API.
- Terraform provider e SDKs oficiais por linguagem.
- API pública estável, paginada e versionada.
- Auditoria exportável, SIEM, retenção configurável e relatórios.
- Request inspection e replay seguro para desenvolvimento.
- Usage metering, quotas, billing e planos.
- Gestão de abuso, reputação, bloqueios e resposta a incidentes.
- Instalação guiada, upgrade sem indisponibilidade e disaster recovery testado.
- Documentação completa por cenário e suporte operacional.

## Critério sugerido para afirmar paridade

A Tunnara somente deve ser apresentada como equivalente de produção após:

1. Control plane distribuído integrado ao data plane.
2. Zero-trust identity e policy enforcement no Edge.
3. Clientes Windows, Linux, macOS, Android e iOS testados.
4. HA multi-host com PostgreSQL/Valkey ou Redis validada sob falhas.
5. NAT traversal e private access completos.
6. Observabilidade, segurança e testes de carga publicados.
7. Instaladores, atualização assinada e migrações reproduzíveis.
8. Kubernetes/Terraform e SDKs estáveis.

Até lá, a descrição adequada é: plataforma self-hosted em desenvolvimento avançado, com runtime funcional de referência e recursos iniciais de túnel e rede privada.
