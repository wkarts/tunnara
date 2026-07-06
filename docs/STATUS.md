# Estado da implementação — Tunnara 2.0.0-rc.2

## Classificação

A 2.0.0-rc.2 é uma **Release Candidate para homologação e produção controlada**. Ela não é apresentada como GA certificada nem como interoperável com protocolos proprietários de ngrok ou Pangolin. A paridade buscada é funcional, com protocolos, agentes e SDKs próprios.

## Caminho funcional oficial

O runtime oficial desta RC é o plano de dados em Node.js 22, utilizado por Agent, Edge e Relay. Ele cobre os fluxos E2E automatizados de HTTP/WebSocket, TCP, UDP, Cloudflare, failover, redes privadas, Policy Engine e Inspector.

O workspace Rust fornece QUIC Bridge, contratos, SDK C e a evolução do plano nativo. Agent/Edge/Relay Rust ainda são classificados como **preview** e não substituem silenciosamente o runtime oficial até passarem pela mesma suíte de interoperabilidade e carga.

## Integrado

- HTTP/HTTPS de aplicação, WebSocket, TCP e UDP públicos.
- Agent com identidade Ed25519, nonce, timestamp e proteção contra replay.
- Control, Edge e Relay separados, com multi-edge/multi-relay e failover.
- QUIC/TLS 1.3 por bridge, com fallback TCP explícito.
- Cloudflare DNS, criação de subdomínios e lifecycle.
- Caddy/Let’s Encrypt DNS-01, wildcard, HTTP/2 e HTTP/3.
- Policy Engine, autenticação, rate limit, transformações e deny-by-default configurável.
- Request Inspector com redação, retenção e replay.
- Targets ponderados, health check e failover.
- WireGuard e redes privadas.
- PostgreSQL ou MySQL no plano de gestão; SQLite/memory no modo embedded; Redis para cache, sessão, presença e filas.
- Prometheus/Grafana, Docker single-node/distribuído, overlay QUIC e Helm.
- Console Vue/Tauri, SDK C/Delphi e projetos Android/iOS.

## Hardening concluído na RC2

- Release imutável por versão/tag; uma versão publicada nunca é reaberta ou movida.
- Draft único coordenado por `release_id` para Core, Runtime, SDK, Desktop e Mobile.
- Upload sequencial, idempotente e com retry, sem Actions Artifact Storage.
- Assets e checksums com nomes exclusivos por plataforma/componente.
- Builds reproduzíveis por checkout da tag da release.
- Pré-releases não são marcadas como `latest`.
- Correção do SEA no Windows sem wrappers `.cmd`.
- Tauri sem tentativa de assinatura Apple quando os secrets estão incompletos.
- Android alinhado ao Kotlin integrado do AGP 9 e AndroidX Core compatível com compileSdk 35.
- iOS com Info.plist gerado, parser wg-quick local e patch idempotente do WireGuardKit para Xcode 16.
- Build number mobile monotônico entre alpha, beta, RC e estável.
- Deploy distribuído com fallback TCP honesto e overlay QUIC explícito.
- Backup, restore, update e rollback do PostgreSQL distribuído.
- Dependabot agrupado e protegido contra upgrades major incompatíveis.

## Gates antes de GA

- ACME/Cloudflare/QUIC validados em domínio e IP públicos reais.
- Agent/Edge/Relay Rust promovidos após interoperabilidade completa ou decisão formal de manter o runtime Node.
- soak test multi-host de pelo menos 7 dias.
- carga dedicada de 10.000 Agents, 100.000 túneis e 50.000 conexões simultâneas por região.
- chaos test de PostgreSQL, Redis, Control, Edge e Relay.
- dispositivos Android/iOS físicos, suspensão/retomada e troca Wi‑Fi/4G/5G.
- assinatura/notarização e atualização/rollback em todas as plataformas.
- pentest e auditoria externa sem achados críticos ou altos abertos.
- SLOs, alertas, disaster recovery e processo de incidentes exercitados.
