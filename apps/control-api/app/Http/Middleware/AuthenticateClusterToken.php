<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateClusterToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('app.cluster_token', '');
        $received = (string) ($request->header('X-Tunnara-Cluster-Token') ?: $request->bearerToken());

        abort_unless(
            $expected !== '' && $received !== '' && hash_equals($expected, $received),
            Response::HTTP_UNAUTHORIZED,
            'Credencial interna do cluster inválida.'
        );

        return $next($request);
    }
}
