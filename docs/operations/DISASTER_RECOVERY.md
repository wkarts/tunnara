# Disaster recovery

## Fonte de verdade

No plano distribuído, PostgreSQL é a fonte de verdade. Redis contém cache, presença, locks, sessões e filas; deve poder ser reconstruído a partir do banco e da reconexão dos nós. Certificados Caddy e chaves de infraestrutura precisam de backup criptografado separado.

## Objetivos de referência

- RPO inicial: 15 minutos, ajustável à política de backup/PITR.
- RTO inicial: 60 minutos para single-region e 15 minutos quando houver região de contingência já preparada.

Esses valores são objetivos, não SLA, até serem exercitados e medidos.

## Exercício trimestral

1. Restaurar PostgreSQL em ambiente isolado.
2. Subir Control, Edge e Relay com novos volumes.
3. Reaplicar secrets e certificados por canal seguro.
4. Validar tenants, Agents, túneis, policies e auditoria.
5. Forçar reconexão e revogação.
6. Medir RPO/RTO real e registrar diferenças.

## Comandos

```bash
./tunnara.sh backup-distributed /backup/tunnara.dump
./tunnara.sh restore-distributed /backup/tunnara.dump --force
```

Nunca execute restore destrutivo sem confirmar ambiente, versão e checksum do backup.
