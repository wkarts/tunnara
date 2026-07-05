<?php

namespace App\Http\Controllers\Api\V1;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController
{
    public function __invoke(): JsonResponse
    {
        $database = ['driver' => config('database.default'), 'status' => 'ok'];
        $cache = ['driver' => config('cache.default'), 'status' => 'ok'];

        try {
            DB::select('select 1');
        } catch (Throwable $exception) {
            $database['status'] = 'error';
            $database['message'] = $exception->getMessage();
        }

        try {
            $key = 'health:'.bin2hex(random_bytes(8));
            Cache::put($key, 'ok', 10);
            if (Cache::get($key) !== 'ok') {
                throw new \RuntimeException('A leitura do valor gravado no cache falhou.');
            }
            Cache::forget($key);
        } catch (Throwable $exception) {
            $cache['status'] = 'error';
            $cache['message'] = $exception->getMessage();
        }

        $healthy = $database['status'] === 'ok' && $cache['status'] === 'ok';

        return response()->json([
            'status' => $healthy ? 'ok' : 'degraded',
            'service' => 'control-api',
            'version' => config('app.version'),
            'database' => $database,
            'cache' => $cache,
            'sessionDriver' => config('session.driver'),
            'queueDriver' => config('queue.default'),
        ], $healthy ? 200 : 503);
    }
}
