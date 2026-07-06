# Relatório de validação — Tunnara Platform 1.1.3

Data: 6 de julho de 2026.

## Incidente analisado

Múltiplos merges continuaram usando `VERSION=1.1.2`. O workflow tentou converter a release publicada `v1.1.2` em draft, reposicionou a tag para um novo commit e depois consultou a release pelo endpoint de tag. A conversão produziu drafts duplicados/sem associação estável à tag e a consulta seguinte retornou `HTTP 404`.

## Causas corrigidas

- ausência de incremento SemVer antes da execução da release;
- uso da mesma versão para commits diferentes;
- reabertura de releases já publicadas;
- movimentação forçada de tags já publicadas;
- descoberta de drafts somente pela tag;
- `tauri-action` sem `releaseId`, permitindo criação de um draft desktop separado;
- ausência de bloqueio para releases e drafts duplicados.

## Nova política

- `Version and release after merge` calcula a próxima versão após merge em `main`;
- o incremento padrão é `patch`; labels permitem `major`, `minor`, `patch` ou `none`;
- um bump explícito já presente no Pull Request é preservado;
- `npm run version:set` sincroniza os 24 pontos de versão e os builds mobile;
- a alteração sincronizada é gravada na `main` antes do dispatch da release;
- releases publicadas e tags são imutáveis;
- somente drafts da mesma versão podem ser retomados;
- o workflow desktop recebe o `releaseId` exato do draft coordenado.

## Validações concluídas

- `npm ci --ignore-scripts`;
- `npm run version:check`;
- `npm run validate:release`;
- `npm run repository:check`;
- `npm run validate:node`;
- `npm run validate:shell`;
- parse YAML de todos os workflows;
- `bash -n` dos blocos Bash incorporados aos workflows;
- cenários de incremento explícito, patch, minor e major;
- aplicação limpa do patch sobre o pacote v7.

## Resultado

A base foi elevada para `1.1.3`. Novos merges elegíveis não reutilizam `1.1.2`: o versionamento ocorre antes da release, e o pipeline rejeita qualquer tentativa de sobrescrever uma versão já publicada.
