#!/bin/sh
set -eu

mkdir -p \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

if [ -z "${APP_KEY:-}" ]; then
  echo "ERRO: APP_KEY não configurada. Gere com: php artisan key:generate --show" >&2
  exit 1
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

php artisan config:cache

exec /usr/bin/supervisord -c /etc/supervisord.conf
