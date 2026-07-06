#!/usr/bin/env bash
set -Eeuo pipefail

TAG="${1:-}"
PREFERRED_ID="${2:-${RELEASE_ID:-}}"

[[ -n "$TAG" ]] || { echo "Uso: $0 <tag> [release-id]" >&2; exit 2; }
command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) não encontrado." >&2; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq não encontrado." >&2; exit 1; }
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY não configurado}"
: "${GH_TOKEN:?GH_TOKEN não configurado}"

if [[ -n "$PREFERRED_ID" ]]; then
  [[ "$PREFERRED_ID" =~ ^[0-9]+$ ]] || {
    echo "release-id inválido: $PREFERRED_ID" >&2
    exit 2
  }

  actual_tag="$(gh api "repos/$GITHUB_REPOSITORY/releases/$PREFERRED_ID" --jq .tag_name)"
  [[ "$actual_tag" == "$TAG" ]] || {
    echo "A release $PREFERRED_ID pertence à tag $actual_tag, não a $TAG." >&2
    exit 1
  }

  printf '%s\n' "$PREFERRED_ID"
  exit 0
fi

release_ids="$({
  gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100"
} | jq -r --arg tag "$TAG" '.[] | select(.tag_name == $tag) | .id' | awk 'NF && !seen[$0]++')"

count="$(printf '%s\n' "$release_ids" | awk 'NF { count += 1 } END { print count + 0 }')"
case "$count" in
  0)
    echo "Nenhuma release encontrada para $TAG, incluindo drafts." >&2
    exit 3
    ;;
  1)
    printf '%s\n' "$release_ids"
    ;;
  *)
    echo "Mais de uma release encontrada para $TAG: $(printf '%s' "$release_ids" | tr '\n' ' ')" >&2
    echo "Remova drafts duplicadas antes de prosseguir." >&2
    exit 1
    ;;
esac
