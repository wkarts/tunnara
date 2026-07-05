<?php

namespace App\Http\Middleware;

use App\Models\ServiceToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateServiceToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        abort_unless(
            is_string($plainToken) && $plainToken !== '',
            Response::HTTP_UNAUTHORIZED,
            'Token ausente.'
        );

        $token = ServiceToken::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->whereNull('revoked_at')
            ->first();

        abort_unless(
            $token && (! $token->expires_at || $token->expires_at->isFuture()),
            Response::HTTP_UNAUTHORIZED,
            'Token inválido ou expirado.'
        );

        $token->forceFill(['last_used_at' => now()])->save();
        $request->attributes->set('service_token', $token);

        return $next($request);
    }
}
