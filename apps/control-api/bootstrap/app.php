<?php

use App\Http\Middleware\AuthenticateClusterToken;
use App\Http\Middleware\AuthenticateServiceToken;
use App\Http\Middleware\RequireServiceAbility;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'service.token' => AuthenticateServiceToken::class,
            'service.ability' => RequireServiceAbility::class,
            'cluster.token' => AuthenticateClusterToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // As rotas /api retornam exceções em JSON pelo comportamento padrão do Laravel.
    })
    ->create();
