# Política de Segurança — Tunnara

## Comunicação responsável

Não abra issue pública para vulnerabilidades. Utilize o canal privado configurado no GitHub Security Advisories do repositório.

Inclua versão, componente, impacto, forma de reprodução e mitigação sugerida. Não inclua tokens, certificados ou dados reais de clientes.

## Controles da versão 1.0.1

- TLS 1.3 no QUIC e TLS configurável no Relay.
- Let’s Encrypt automático por DNS-01.
- Prova Ed25519, nonce e janela temporal por conexão Agent/Relay.
- Tokens de provisionamento de uso único.
- Tokens administrativos por hash e scopes.
- Segredos Cloudflare criptografados com chave mestra AES-GCM.
- Isolamento obrigatório por organização.
- Restrição do Agent a loopback por padrão.
- Rate limit local de provisionamento.
- Auditoria de operações administrativas.
- CSP e capacidades Tauri restritas conforme configuração do Console.

## Segredos de produção

Nunca versionar:

- `.env`;
- token Cloudflare;
- chave mestra Tunnara;
- token de cluster;
- chaves privadas TLS/QUIC;
- keystore Android;
- certificados Apple;
- provisioning profiles Apple;
- chaves privadas App Store Connect;
- service account do Google Play;
- bancos e backups.

Use secrets do GitHub, Docker secrets, Vault ou mecanismo equivalente.

## Cloudflare

Use um API Token específico para a zona do Tunnara, com permissões mínimas `Zone:Read` e `DNS:Edit`. Não use Global API Key.

## Alta disponibilidade

Não compartilhe o arquivo SQLite em NFS entre múltiplos hosts. Para Control Plane multi-host, use PostgreSQL/datastore replicado. Edges e Relays são distribuíveis e não armazenam o estado empresarial principal.


## Builds mobile

Os workflows de compilação não exigem secrets de loja. Assinatura e publicação são etapas separadas:

- APK debug usa somente a chave de debug do ambiente de build;
- APK/AAB release ficam sem assinatura quando o keystore não está disponível;
- IPA sem assinatura não é instalável em dispositivos iOS comuns;
- certificados, perfis e chaves de publicação são importados apenas em keychains temporários;
- publicação Google Play/TestFlight é desabilitada por padrão e não bloqueia os artefatos de build.
