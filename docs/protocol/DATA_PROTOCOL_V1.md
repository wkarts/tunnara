# Protocolo de dados Tunnara v1

O Agent abre uma conexão de saída persistente para o Relay por TCP, TLS ou QUIC Bridge. O protocolo de aplicação utiliza frames com tamanho prefixado e mensagens JSON de controle; payloads binários são codificados em Base64 no runtime de referência.

## Autenticação

`agent_hello` contém Agent ID, token de sessão, versão, timestamp, nonce e prova Ed25519 sobre todos esses campos. O Relay valida a organização, expiração, revogação, assinatura e replay.

## HTTP/WebSocket

- `proxy_request` / `proxy_response` para HTTP.
- `upgrade_open`, `stream_data` e `stream_close` para upgrade/WebSocket.

## TCP

- `stream_open`.
- `stream_opened`.
- `stream_data`.
- `stream_close`.

## UDP

- `udp_datagram`.
- `udp_response`.
- `udp_close`.

## QUIC

O `tunnara-quic-bridge` mapeia cada conexão persistente TCP para um stream bidirecional QUIC. A camada de aplicação acima permanece idêntica, permitindo migração sem quebrar clientes.
