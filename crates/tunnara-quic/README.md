# Tunnara QUIC

Camada QUIC/TLS 1.3 baseada em Quinn, com streams bidirecionais multiplexados, keepalive, migração de conexão e datagramas.

O crate é utilizado pelo `tunnara-quic-bridge`, que transporta conexões Agent–Relay do runtime estável sobre QUIC sem alterar o protocolo de aplicação. O workspace possui teste de roundtrip e é compilado pelo GitHub Actions.
