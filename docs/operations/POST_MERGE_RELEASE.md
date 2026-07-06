# Release após merge

A versão e a release são coordenadas automaticamente após o merge na `main`.

## Fluxo padrão

1. O merge chega à `main`.
2. O workflow lê todas as releases publicadas, incluindo prereleases.
3. Calcula a próxima versão SemVer.
4. Sincroniza os manifestos e builds mobile.
5. Cria o commit `chore(release): prepare vX.Y.Z`.
6. Dispara a release com a versão e o SHA imutável.
7. A release permanece draft até todos os builds terminarem.

## Release Candidate

Enquanto `VERSION` possuir sufixo `-rc.N`, merges sem label avançam automaticamente:

```text
2.0.0-rc.2 → 2.0.0-rc.3 → 2.0.0-rc.4
```

Para promover a RC:

```text
release:stable
```

Resultado:

```text
2.0.0-rc.N → 2.0.0
```

## Falha de build

A release permanece draft. Reexecute o workflow `Release after merge` usando a mesma `release_version` e o mesmo `release_sha`. Releases já publicadas não podem ser reconstruídas; uma correção posterior deve receber nova versão.
