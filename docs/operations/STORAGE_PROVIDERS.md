# Provedores de armazenamento e estado

A Tunnara oferece dois perfis de servidor, com responsabilidades diferentes.

## 1. Runtime embarcado

O runtime em `runtime/node` executa Control, Edge e Relay no mesmo produto e é indicado para instalação Community de nó único, laboratórios, desenvolvimento e VPS pequenas.

Provedores disponíveis:

| `TUNNARA_STORAGE_DRIVER` | Persistência | Uso recomendado |
|---|---:|---|
| `sqlite` | Sim | Community, Docker single-node e instalação nativa |
| `memory` | Não | Testes efêmeros e desenvolvimento |

Exemplo persistente:

```bash
TUNNARA_STORAGE_DRIVER=sqlite \
TUNNARA_DATA_DIR=/var/lib/tunnara \
tunnara-server serve-all
```

Exemplo efêmero:

```bash
TUNNARA_STORAGE_DRIVER=memory tunnara-server serve-all
```

No modo `memory`, backup e restore ficam indisponíveis por definição. O runtime embarcado não deve ter o mesmo arquivo SQLite aberto por dois processos Control em hosts diferentes.

## 2. Control API distribuída

A aplicação `apps/control-api` é o plano de gestão Laravel e suporta:

### Banco de dados

- SQLite;
- PostgreSQL;
- MySQL 8.4 ou MariaDB compatível.

### Cache, sessão e filas

- `memory`: cache e sessão `array`, fila `sync`;
- `local`: cache e sessão em arquivos, fila `sync`;
- `database`: cache, sessão e filas no banco selecionado;
- `redis`: cache, sessão e filas em bancos Redis separados.

A escolha é feita pelas variáveis do Laravel:

```dotenv
DB_CONNECTION=sqlite|pgsql|mysql
CACHE_STORE=array|file|database|redis
SESSION_DRIVER=array|file|database|redis
QUEUE_CONNECTION=sync|database|redis
```

As migrações são portáveis entre os três bancos e incluem as tabelas necessárias para cache, locks, sessões, filas, batches e falhas.

## Docker

O diretório `deploy/docker/storage` contém composições combináveis.

```bash
cd deploy/docker/storage
./storage.sh init
```

SQLite e estado local:

```bash
./storage.sh up sqlite local
```

SQLite e estado em memória:

```bash
./storage.sh up sqlite memory
```

PostgreSQL e Redis:

```bash
./storage.sh up postgres redis
```

MySQL e estado no próprio banco:

```bash
./storage.sh up mysql database
```

Diagnóstico:

```bash
./storage.sh doctor
```

A resposta de `/api/v1/health` informa os drivers ativos e executa uma leitura real no banco e uma gravação/leitura real no cache.

## Instalação nativa

Modelos de ambiente:

```text
deploy/native/config/tunnara-control.sqlite.env.example
deploy/native/config/tunnara-control.postgres-redis.env.example
deploy/native/config/tunnara-control.mysql-redis.env.example
```

## Alta disponibilidade

`deploy/docker/docker-compose.ha.yml` fornece redundância do plano de dados com dois Edges e dois Relays. O Control embarcado permanece único e persistido em SQLite para evitar compartilhamento inseguro do arquivo entre processos.

Alta disponibilidade completa do plano de gestão deve utilizar a Control API com PostgreSQL ou MySQL e Redis, atrás de um balanceador, com banco gerenciado/replicado conforme a infraestrutura escolhida.
