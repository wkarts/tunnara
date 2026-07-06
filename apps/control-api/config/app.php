<?php

return [
    'name' => env('APP_NAME', 'Tunnara Control API'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'America/Bahia',
    'locale' => 'pt_BR',
    'fallback_locale' => 'en',
    'faker_locale' => 'pt_BR',
    'key' => env('APP_KEY'),
    'cipher' => 'AES-256-CBC',
    'version' => env('APP_VERSION', '2.0.0-rc.1'),
    'cluster_token' => env('TUNNARA_CLUSTER_TOKEN', ''),
    'public_control_url' => env('TUNNARA_PUBLIC_CONTROL_URL', env('APP_URL', 'http://localhost')),
    'public_relay_url' => env('TUNNARA_PUBLIC_RELAY_URL', 'tcp://127.0.0.1:7300'),
];
