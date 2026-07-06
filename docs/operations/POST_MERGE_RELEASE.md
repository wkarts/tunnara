# Release após merge

A release não é criada em cada merge. O evento automático observa mudanças no arquivo `VERSION`.

## Processo

```bash
git switch -c release/v1.1.1
npm run version:set -- 1.1.1
npm run version:check
git add --all
git commit -m "chore: prepare Tunnara v1.1.1"
git push -u origin release/v1.1.1
```

Depois do merge:

- a release é criada como draft;
- os assets centrais são enviados;
- Runtime, SDK, Desktop, Mobile e Docker executam como workflows reutilizáveis;
- a release só é publicada após sucesso completo.

Se um build falhar, a release permanece em draft e pode ser reconstruída com `force_rebuild=true`.
