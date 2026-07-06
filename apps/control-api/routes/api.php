<?php

use App\Http\Controllers\Api\V1\AgentController;
use App\Http\Controllers\Api\V1\AgentRegistrationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InspectionController;
use App\Http\Controllers\Api\V1\Internal\ClusterController;
use App\Http\Controllers\Api\V1\NodeController;
use App\Http\Controllers\Api\V1\OverviewController;
use App\Http\Controllers\Api\V1\PolicyController;
use App\Http\Controllers\Api\V1\ProvisioningTokenController;
use App\Http\Controllers\Api\V1\TunnelController;
use App\Http\Controllers\Api\V1\TunnelTargetController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class);
    Route::post('/agents/register', AgentRegistrationController::class)->middleware('throttle:30,15');

    Route::middleware('service.token')->group(function (): void {
        Route::get('/overview', OverviewController::class)->middleware('service.ability:tunnels:read');
        Route::get('/agents', [AgentController::class,'index'])->middleware('service.ability:agents:read');
        Route::post('/agents', [AgentController::class,'store'])->middleware('service.ability:agents:write');
        Route::get('/agents/{agent}', [AgentController::class,'show'])->middleware('service.ability:agents:read');
        Route::delete('/agents/{agent}', [AgentController::class,'destroy'])->middleware('service.ability:agents:write');

        Route::apiResource('tunnels', TunnelController::class)
            ->middlewareFor(['index','show'],'service.ability:tunnels:read')
            ->middlewareFor(['store','update','destroy'],'service.ability:tunnels:write');
        Route::get('/tunnels/{tunnel}/targets',[TunnelTargetController::class,'index'])->middleware('service.ability:tunnels:read');
        Route::post('/tunnels/{tunnel}/targets',[TunnelTargetController::class,'store'])->middleware('service.ability:tunnels:write');
        Route::patch('/tunnels/{tunnel}/targets/{target}',[TunnelTargetController::class,'update'])->middleware('service.ability:tunnels:write');
        Route::delete('/tunnels/{tunnel}/targets/{target}',[TunnelTargetController::class,'destroy'])->middleware('service.ability:tunnels:write');

        Route::apiResource('policies', PolicyController::class)
            ->middlewareFor(['index','show'],'service.ability:policies:read')
            ->middlewareFor(['store','update','destroy'],'service.ability:policies:write');
        Route::get('/inspections',[InspectionController::class,'index'])->middleware('service.ability:inspector:read');
        Route::get('/inspections/{inspection}',[InspectionController::class,'show'])->middleware('service.ability:inspector:read');
        Route::delete('/inspections',[InspectionController::class,'purge'])->middleware('service.ability:inspector:write');
        Route::delete('/inspections/{inspection}',[InspectionController::class,'destroy'])->middleware('service.ability:inspector:write');
        Route::apiResource('provisioning-tokens',ProvisioningTokenController::class)->only(['index','store','destroy'])
            ->middlewareFor('index','service.ability:provisioning:read')
            ->middlewareFor(['store','destroy'],'service.ability:provisioning:write');
        Route::get('/nodes',[NodeController::class,'index'])->middleware('service.ability:nodes:read');
    });
});

Route::prefix('internal/v1')->middleware('cluster.token')->controller(ClusterController::class)->group(function (): void {
    Route::post('/nodes/register','registerNode');
    Route::post('/nodes/heartbeat','heartbeatNode');
    Route::post('/agents/authenticate','authenticateAgent');
    Route::post('/agents/presence','presence');
    Route::post('/agents/heartbeat','agentHeartbeat');
    Route::get('/tunnels','listTunnels');
    Route::get('/tunnels/{tunnel}','routeByTunnel');
    Route::get('/routes/hostname/{hostname}','routeByHostname')->where('hostname','.*');
    Route::post('/tunnel-targets/{target}/health','targetHealth');
    Route::post('/inspections','saveInspection');
});
