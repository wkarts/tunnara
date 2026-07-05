# Tunnara HA

Stack de alta disponibilidade **single-host** com dois Controls compartilhando SQLite/WAL, dois Relays, dois Edges, HAProxy interno e Caddy/HTTP3 na entrada. O Agent recebe múltiplos Relays e alterna automaticamente quando um deles cai.

Para multi-host, execute `control`, `relay` e `edge` em VPS distintas usando `TUNNARA_INTERNAL_CONTROL_URL`, `TUNNARA_CLUSTER_TOKEN`, URLs públicas/internas dos nós e um datastore compartilhado/gerenciado para o Control Plane. Os Edges e Relays já operam remotamente contra o Control API.

TCP/UDP público em HA multi-host deve ser anunciado por IPs/ports de cada Edge ou por um balanceador L4 externo. O Caddy desta stack balanceia HTTP/HTTPS/WebSocket.
