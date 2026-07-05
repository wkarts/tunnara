#!/usr/bin/env bash
set -Eeuo pipefail

OWNER="${1:-}"
REPOSITORY="${2:-tunnara}"
VISIBILITY="${3:-public}"
[[ -n "$OWNER" ]] || { echo "Uso: $0 OWNER [REPOSITORY] [public|private|internal]" >&2; exit 1; }
[[ "$VISIBILITY" =~ ^(public|private|internal)$ ]] || { echo 'Visibilidade inválida.' >&2; exit 1; }
command -v gh >/dev/null || { echo 'GitHub CLI (gh) não encontrada.' >&2; exit 1; }
gh auth status >/dev/null
node scripts/github/validate-repository.mjs
npm run version:check

if [[ ! -d .git ]]; then git init; fi
git checkout -B main
if ! git config user.name >/dev/null || ! git config user.email >/dev/null; then
  echo 'Configure git user.name e git user.email.' >&2; exit 1
fi
git add --all
git diff --cached --quiet || git commit -m "feat: publish Tunnara platform $(cat VERSION)"

FULL_NAME="$OWNER/$REPOSITORY"
if gh repo view "$FULL_NAME" >/dev/null 2>&1; then
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$FULL_NAME.git"
  git push -u origin main
else
  gh repo create "$FULL_NAME" "--$VISIBILITY" --source=. --remote=origin --push \
    --description 'Tunnara — plataforma self-hosted de túneis reversos seguros.'
fi

echo "Repositório publicado: https://github.com/$FULL_NAME"
