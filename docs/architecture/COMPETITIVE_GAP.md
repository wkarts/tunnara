# Alinhamento funcional com ngrok e Pangolin

A Tunnara 2.0 RC busca paridade funcional, não compatibilidade binária ou de protocolo.

## Capacidades alinhadas

| Área | Tunnara 2.0 RC |
|---|---|
| Agente iniciado de dentro da rede | Sim |
| HTTP/HTTPS/WebSocket | Sim |
| TCP/UDP | Sim |
| Domínio próprio e subdomínio automático | Sim |
| TLS automático | Sim |
| QUIC | Sim, por bridge nativo |
| Rede privada | Sim, WireGuard |
| Multi-edge/multi-relay | Sim |
| Múltiplos targets e failover | Sim |
| Política no Edge | Sim |
| JWT/OIDC, Basic Auth e API key | Sim |
| Rate limit e transformações | Sim |
| Request Inspector e replay | Sim |
| Control Plane PostgreSQL/Redis | Sim |
| Console e API | Sim |
| Docker e Helm | Sim |
| SDK C/Delphi | Sim |
| Android/iOS | Projetos e pipelines entregues |

## Diferenças deliberadas

- Não executa agentes nem protocolos proprietários do ngrok/Pangolin.
- Cloudflare é uma integração opcional, não requisito do núcleo.
- O runtime embedded permanece disponível para Community single-node.
- O Control API distribuído é separado do plano de dados.

## Lacunas para equivalência operacional de grande escala

- NAT traversal P2P/STUN/ICE ainda não substitui o relay em todos os cenários.
- Kubernetes Operator e CRDs ainda não existem; há Helm Chart e recursos padrão.
- SAML/SCIM/LDAP e device posture não estão completos.
- Geo-routing/Anycast dependem da infraestrutura de implantação.
- O Request Inspector ainda não possui armazenamento analítico de alta escala.
- Não há certificação externa de segurança ou SLA público.
- A escala global precisa ser comprovada em ambiente dedicado e multi-região.

A versão RC é adequada para homologação e produção controlada. A promoção para GA depende dos gates documentados, não apenas de uma alteração de versão.
