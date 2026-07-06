# Release após merge

A release não é criada em cada merge. O evento automático observa mudanças no arquivo `VERSION`.

## Processo

```bash
git switch -c release/vX.Y.Z
npm run version:set -- X.Y.Z
npm run version:check
git add --all
git commit -m "chore: prepare Tunnara vX.Y.Z"
git push -u origin release/vX.Y.Z
```

Depois do merge:

- a release é criada como draft;
- os assets centrais são enviados;
- Runtime, SDK, Desktop, Mobile e Docker executam como workflows reutilizáveis;
- a release só é publicada após sucesso completo.

Se um build falhar, a release permanece em draft e pode ser reconstruída com `force_rebuild=true`.
