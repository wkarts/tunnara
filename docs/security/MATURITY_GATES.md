# Gates de maturidade para Tunnara 2.0 GA

A promoção de RC para GA exige evidências reprodutíveis.

## Segurança

- threat model revisado por terceiro;
- pentest externo sem achados críticos/altos abertos;
- fuzzing contínuo do protocolo e Policy Engine;
- teste automatizado de isolamento cross-tenant;
- rotação de tokens, chaves e certificados;
- política de retenção e consentimento do Request Inspector;
- assinatura dos binários e atualizações.

## Confiabilidade

- soak test multi-host mínimo de 7 dias;
- failover de Edge e Relay sem perda de controle;
- perda e recuperação de PostgreSQL/Redis;
- rolling update e rollback;
- teste de partição de rede;
- verificação de backup e restore.

## Escala

- 10.000 Agents conectados em ambiente dedicado;
- 100.000 túneis cadastrados;
- carga simultânea por protocolo;
- uso de CPU, memória, file descriptors e banda documentados;
- limites e degradação controlada.

## Clientes

- Windows, Linux e macOS em versões suportadas;
- Android e iOS em dispositivos físicos;
- suspensão/retomada e troca de rede;
- VPN always-on e split tunnel quando aplicável.

## Operação

- dashboards, alertas e runbooks;
- SLOs definidos;
- processo de incidentes;
- política de versões suportadas;
- matriz de compatibilidade do protocolo.
