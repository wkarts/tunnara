# Policy Engine

O mecanismo de políticas executa regras ordenadas no Edge.

## Matchers

- método;
- hostname;
- prefixo ou regex de path;
- CIDR de origem;
- headers.

## Ações

- allow/deny;
- redirect;
- Basic Auth;
- API key;
- JWT/OIDC;
- rate limit;
- adicionar/remover headers;
- rewrite de path.

## Segurança

- passwords são armazenadas como scrypt;
- API keys são persistidas somente por hash;
- JWKS possui cache e timeout;
- headers de autenticação são redigidos no Inspector;
- `defaultAction=deny` é recomendado para recursos privados.
