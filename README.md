# Tunnara Platform 1.0.0

A Tunnara é uma plataforma self-hosted de conectividade para publicar serviços atrás de NAT/CGNAT, criar túneis HTTP/HTTPS/TCP/UDP, formar redes privadas WireGuard e integrar aplicações por SDK.

## Capacidades entregues

- Control API multi-tenant com tokens por escopo, provisionamento de uso único, auditoria e revogação.
- Edge HTTP/HTTPS com roteamento por hostname, WebSocket/upgrade, TCP e UDP público.
- Relay persistente e multiplexado, reconexão, heartbeat e failover entre múltiplos relays.
- Agent multiplataforma, CLI, daemon, API local, destinos loopback por padrão e reconexão automática.
- Transporte TCP/TLS e transporte QUIC/TLS 1.3 pelo `tunnara-quic-bridge`.
- Caddy HTTP/1.1, HTTP/2 e HTTP/3 na borda.
- Cloudflare DNS API: validação de token/zona, registros base, wildcard e subdomínios por túnel.
- SSL automático Let’s Encrypt por ACME DNS-01, incluindo certificado wildcard.
- Cloudflare Tunnel opcional usando QUIC.
- Multi-edge e multi-relay com registro de nós, heartbeat, descoberta e failover do plano de dados.
- Redes privadas WireGuard, peers, CIDR virtual, topologia mesh ou hub-spoke e lifecycle pelo Agent.
- SDK C ABI compartilhado/estático e unit Delphi com HTTP, TCP, UDP e redes privadas.
- Cliente Android com `VpnService`/WireGuard e cliente iOS com Network Extension/WireGuardKit.
- Console Vue 3/Tauri para agentes, túneis, DNS/Cloudflare, nós, redes e auditoria.
- Docker Compose single-node, Cloudflare/ACME/QUIC e stack HA.
- Instalação nativa, CloudPanel, systemd, Windows e macOS.
- GitHub Actions para CI, releases, containers, desktop, SDKs e mobile.

## Arquitetura

```text
                              ┌─────────────────────┐
                              │ Tunnara Console     │
                              └──────────┬──────────┘
                                         │ REST
                              ┌──────────▼──────────┐
                              │ Control API         │
                              │ tenants, tokens,    │
                              │ DNS, nodes, redes   │
                              └─────┬─────────┬─────┘
                                    │         │
                          cluster   │         │ provisioning
                                    │         │
          ┌─────────────────────────▼──┐   ┌──▼───────────────────┐
Internet ─► Edge HTTP/HTTPS/TCP/UDP    │   │ Agent / SDK          │
          └──────────────────┬─────────┘   │ localhost / rede     │
                             │             └──────────▲───────────┘
                             ▼                        │
                    ┌──────────────────┐              │
                    │ Relay distribuído├──────────────┘
                    └──────────────────┘   TCP/TLS ou QUIC/TLS 1.3
```

## Início rápido de produção: Cloudflare + Let’s Encrypt + QUIC

Requisitos:

- VPS Linux com Docker Engine e Docker Compose v2.
- Domínio administrado pela Cloudflare.
- API Token Cloudflare restrito à zona, com leitura da zona e edição de DNS.
- Portas públicas `80/tcp`, `443/tcp`, `443/udp`, `7443/udp` e a faixa TCP/UDP configurada.

```bash
cd deploy/docker
cp .env.example .env
./tunnara.sh init
```

Edite `.env`:

```dotenv
TUNNARA_BASE_DOMAIN=tunnel.seudominio.com.br
TUNNARA_PUBLIC_HOST=edge.seudominio.com.br
TUNNARA_PUBLIC_CONTROL_URL=https://control.tunnel.seudominio.com.br
TUNNARA_PUBLIC_RELAY_URL=quic://relay.tunnel.seudominio.com.br:7443
TUNNARA_CORS_ORIGIN=https://console.tunnel.seudominio.com.br

CLOUDFLARE_ZONE_NAME=seudominio.com.br
CLOUDFLARE_API_TOKEN=TOKEN_RESTRITO_DA_ZONA
TUNNARA_ACME_EMAIL=administrador@seudominio.com.br
TUNNARA_ACME_CA=https://acme-v02.api.letsencrypt.org/directory
TUNNARA_CLOUDFLARE_EDGE_ADDRESS=IP_PUBLICO_DA_VPS
TUNNARA_QUIC_PUBLIC_HOST=relay.tunnel.seudominio.com.br
```

Suba a plataforma:

```bash
./tunnara.sh preflight
./tunnara.sh up-production
./tunnara.sh status-production
```

Esse comando:

1. inicia Server, Console, Caddy e QUIC Bridge;
2. valida a integração Cloudflare;
3. cria/atualiza `control`, `console`, `relay`, domínio raiz e wildcard;
4. emite e renova certificados Let’s Encrypt por DNS-01;
5. habilita HTTP/3 em `443/udp`;
6. publica o Relay em QUIC na porta `7443/udp`.

## Registrar um Agent

No servidor:

```bash
cd deploy/docker
./tunnara.sh provision servidor-erp
```

No cliente, instale `tunnara` e `tunnara-quic-bridge`, depois:

```bash
tunnara login \
  --token tnr_prov_TOKEN \
  --name servidor-erp \
  --control-url https://control.tunnel.seudominio.com.br

tunnara serve
```

Quando a Control API anuncia `quic://relay...`, o Agent inicia automaticamente o bridge QUIC. Certificados públicos do Let’s Encrypt usam o repositório de CAs do sistema; `--quic-ca` é necessário apenas para uma CA privada.

## Criar túneis

```bash
# HTTP com subdomínio automático Cloudflare
tunnara http 8080 --domain erp.tunnel.seudominio.com.br --auto-dns

# HTTPS de aplicação
tunnara https 8443 --domain api.tunnel.seudominio.com.br --auto-dns

# TCP público
tunnara tcp 22 --remote-port 22022

# UDP público
tunnara udp 51820 --remote-port 25182
```

Subdomínios dentro do domínio base são cobertos pelo wildcard Let’s Encrypt. O lifecycle DNS pode ser vinculado ao túnel: criação no cadastro e remoção ao excluir.

## Redes privadas WireGuard

No Console, crie uma rede com CIDR e topologia. No Agent:

```bash
tunnara network list
tunnara network join UUID_DA_REDE
tunnara network leave UUID_DA_REDE
```

Linux requer `wireguard-tools`; Windows requer WireGuard oficial; macOS pode usar `wireguard-go`/WireGuard; Android e iOS usam os backends nativos incluídos nos projetos mobile.

## Alta disponibilidade

```bash
cd deploy/docker
./tunnara.sh up-ha
```

A stack HA inclui:

- dois Controls atrás de HAProxy para redundância local;
- dois Relays registrados no Control Plane;
- dois Edges;
- descoberta de presença do Agent;
- lista de relays no provisionamento;
- reconexão/failover automático do Agent;
- Caddy com HTTP/3 e wildcard ACME.

Para múltiplos hosts, execute Edges e Relays em VPS distintas usando o mesmo `TUNNARA_CLUSTER_TOKEN` e uma Control API central. Para HA do banco/control plane entre hosts, use a implementação Laravel/PostgreSQL ou um datastore replicado; não compartilhe SQLite por NFS.

## Cloudflare Tunnel opcional

Além do DNS normal, a composição pode iniciar um Cloudflare Tunnel:

```bash
# Configure CLOUDFLARED_TUNNEL_TOKEN no .env
./tunnara.sh up-cloudflare-tunnel
```

O `cloudflared` usa QUIC e conexões de saída. Túneis TCP/UDP públicos diretos continuam exigindo portas públicas ou produtos Cloudflare compatíveis com esses protocolos.

## SDK C ABI

```bash
npm run sdk:c:test
```

Artefatos:

- Windows: `tunnara.dll`, `.lib` e biblioteca estática.
- Linux: `libtunnara.so` e `libtunnara.a`.
- macOS: `libtunnara.dylib` e `libtunnara.a`.

Funções disponíveis:

- status do Agent;
- listar/criar/excluir túneis HTTP/TCP/UDP;
- listar/entrar/sair de redes privadas;
- tratamento de erro e memória com ABI estável por handles opacos.

## Delphi

A unit `sdk/delphi/TunnaraAgent.pas` carrega a biblioteca dinamicamente e expõe:

```pascal
Agent := TTunnaraAgent.Create('127.0.0.1', 7390, LocalApiToken);
try
  Json := Agent.CreateHttpTunnel(8080, 'erp.tunnel.seudominio.com.br', True);
  Json := Agent.CreateTcpTunnel(3050, 23050);
  Json := Agent.JoinNetwork(NetworkId, True);
finally
  Agent.Free;
end;
```

Há exemplos e documentação em `sdk/delphi`.

## Android e iOS

- Android: projeto Gradle/Kotlin com WireGuard userspace e autorização `VpnService`.
- iOS: SwiftUI, `NETunnelProviderManager`, Packet Tunnel Network Extension e WireGuardKit.

Os builds mobile são independentes das lojas:

- sem secrets, o Android gera APK debug instalável, APK release sem assinatura e AAB sem assinatura;
- sem credenciais Apple, o iOS gera aplicativo de Simulator e IPA `iphoneos` sem assinatura;
- com secrets de assinatura, os mesmos workflows acrescentam APK/AAB e IPA assinados;
- Google Play e TestFlight são jobs opcionais, desabilitados por padrão, e não impedem a geração dos binários.

O IPA sem assinatura serve para CI, auditoria e assinatura posterior, mas não instala em dispositivos iOS comuns. Consulte `docs/mobile/BUILD_AND_DISTRIBUTION.md`.

## GitHub

```bash
gh auth login
./scripts/github/publish.sh SUA_ORGANIZACAO tunnara public
```

Pipelines disponíveis:

- testes Node e end-to-end;
- Vue/Tauri;
- Rust, QUIC e Laravel;
- imagens multi-arquitetura no GHCR;
- executáveis Agent/Server;
- SDK C multiplataforma;
- APK/AAB Android e IPA/projeto iOS;
- CodeQL, Dependabot, SBOM, provenance e checksums.

## Validação

```bash
npm ci
npm --prefix apps/console ci
npm run validate
```

O conjunto cobre HTTP/WebSocket, TCP, UDP, Cloudflare/DNS, multi-edge/relay, failover, WireGuard, redes privadas, configuração ACME/HTTP3/QUIC, SDK C e Console.

## Limites externos

Para operar em produção são necessários dados que não podem ser embutidos no código:

- domínio e API Token Cloudflare;
- e-mail ACME;
- endereço IP ou hostname público;
- certificados de assinatura de código;
- keystore Android;
- conta, equipe, certificados e provisioning profiles Apple.

## Licenciamento

- Servidor e Console: `AGPL-3.0-or-later`.
- SDKs e QUIC Bridge: `Apache-2.0` conforme arquivos específicos.

Revise a estratégia com assessoria jurídica antes de uma oferta comercial.
