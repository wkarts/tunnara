# Política de Segurança — Tunnara

## Comunicação responsável

Não abra issue pública para vulnerabilidades. Utilize GitHub Security Advisories ou o canal privado definido pelo mantenedor. Inclua versão, componente, impacto, reprodução e mitigação, sem tokens, certificados ou dados reais.

## Controles da série 2.0

- TLS 1.3 no transporte QUIC e TLS configurável no Relay.
- Agent com identidade Ed25519, nonce, timestamp e proteção contra replay.
- Provisionamento descartável e sessões com expiração/revogação.
- Tokens administrativos persistidos por hash e limitados por abilities.
- Isolamento obrigatório por organização.
- Segredos Cloudflare criptografados com chave mestra.
- Agent limitado a destinos loopback por padrão.
- Rate limits em provisionamento e Policy Engine.
- Policy Engine com validação defensiva e limites estruturais.
- Request Inspector com redação de Authorization, cookies e campos sensíveis.
- Retenção configurável e manutenção automática de inspeções/auditoria.
- NetworkPolicy, PDB e secrets no Helm Chart.
- Fuzzing automatizado do Policy Engine.

## Request Inspector

A captura deve ser habilitada conscientemente por túnel. Antes de produção:

- defina base legal e política de privacidade;
- limite retenção e tamanho de body;
- evite capturar credenciais, documentos e dados de saúde;
- restrinja `audit:read` e acesso às inspeções;
- use criptografia de volume/banco;
- valide os padrões de redação específicos do negócio.

## Segredos

Nunca versionar `.env`, tokens Cloudflare, master key, cluster token, chaves TLS/QUIC, keystores, certificados Apple, provisioning profiles, service accounts, bancos ou backups. Use GitHub Secrets, Docker/Kubernetes Secrets ou cofre dedicado.

## Alta disponibilidade

Não compartilhe SQLite por NFS. Instalações multi-Control devem usar PostgreSQL ou MySQL e Redis. Proteja a API interna com `TUNNARA_CLUSTER_TOKEN`, rede privada e, antes de GA, mTLS de serviço.

## Builds e publicação

Build mobile não depende da publicação nas lojas. Assinatura, notarização e publicação são etapas opcionais e separadas. Binários de produção devem ser assinados antes de distribuição pública.

## Status RC

A versão `2.0.0-rc.6` não substitui pentest, auditoria externa, soak test ou avaliação jurídica. Consulte `docs/security/MATURITY_GATES.md`.
