#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_URL="${1:-}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-feat: publish Tunnara platform}"

command -v git >/dev/null || { echo 'git não encontrado.' >&2; exit 1; }
node scripts/github/validate-repository.mjs
npm run version:check

if [[ ! -d .git ]]; then git init; fi
git checkout -B "$DEFAULT_BRANCH"

if ! git config user.name >/dev/null; then
  echo 'Configure git user.name antes de criar o commit.' >&2
  exit 1
fi
if ! git config user.email >/dev/null; then
  echo 'Configure git user.email antes de criar o commit.' >&2
  exit 1
fi

git add --all
git diff --cached --quiet || git commit -m "$COMMIT_MESSAGE"

if [[ -n "$REMOTE_URL" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$REMOTE_URL"; else git remote add origin "$REMOTE_URL"; fi
  git push -u origin "$DEFAULT_BRANCH"
else
  echo 'Repositório local preparado. Informe a URL como primeiro argumento para enviar ao GitHub.'
fi
