#!/usr/bin/env bash
set -Eeuo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

paths=(
  node_modules
  apps/console/node_modules
  apps/console/dist
  apps/console/src-tauri/target
  sdk/c/build
  sdk/mobile/android/.gradle
  sdk/mobile/android/app/build
  sdk/mobile/android/dist
  sdk/mobile/ios/dist
  sdk/mobile/ios/TunnaraMobile.xcodeproj
  target
  dist
  artifacts
  .build
)

for item in "${paths[@]}"; do rm -rf -- "$item"; done
find . -type f \( -name '*.bak' -o -name 'CMakeCache.txt' -o -name 'cmake_install.cmake' \) -delete
find . -type d -name CMakeFiles -prune -exec rm -rf {} +

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git rm -r --cached --ignore-unmatch \
    node_modules apps/console/node_modules apps/console/dist apps/console/src-tauri/target \
    sdk/c/build sdk/mobile/android/.gradle sdk/mobile/android/app/build sdk/mobile/android/dist \
    sdk/mobile/ios/dist sdk/mobile/ios/TunnaraMobile.xcodeproj target dist artifacts .build >/dev/null 2>&1 || true
fi

echo 'Arquivos gerados removidos. Execute npm ci e os builds quando necessário.'
