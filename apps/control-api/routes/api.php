<?php

use App\Http\Controllers\Api\V1\AgentController;
use App\Http\Controllers\Api\V1\OverviewController;
use App\Http\Controllers\Api\V1\TunnelController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', fn (): array => [
        'status' => 'ok',
        'service' => 'control-api',
        'version' => config('app.version'),
    ]);

    Route::middleware('service.token')->group(function (): void {
        Route::get('/overview', OverviewController::class);
        Route::apiResource('agents', AgentController::class)
            ->only(['index', 'store', 'show', 'destroy']);
        Route::apiResource('tunnels', TunnelController::class);
    });
});
