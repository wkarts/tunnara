# Arquitetura Tunnara

```text
Console / API / SDKs
        │
        ▼
Control API (Laravel) ── PostgreSQL / Redis / NATS
        │
        ▼
Coordinator (Rust) ── sessão, configuração, leases e descoberta
        │
   ┌────┴────┐
   ▼         ▼
Edge       Relay
   │         │
   └────┬────┘
        ▼
Agent Core ── serviço local / aplicação embarcada / rede privada
```

O plano de gestão não transporta tráfego. O coordinator não termina tráfego público. Edge e relay são escaláveis horizontalmente e devem permanecer stateless sempre que possível.

## Interface preservada

O template foi mantido como aplicação autônoma em `apps/console`. O visual core, temas, menus expansíveis, tabs, splash, responsividade, providers Web/PWA/Tauri, API interna, WebSocket, webhook e serviços nativos permanecem disponíveis. As páginas de negócio antigas não foram apagadas abruptamente; apenas deixaram de ser a navegação principal.
