<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireServiceAbility
{
    public function handle(Request $request, Closure $next, string $ability): Response
    {
        $token = $request->attributes->get('service_token');
        $abilities = is_array($token?->abilities) ? $token->abilities : [];

        abort_unless(
            in_array('*', $abilities, true) || in_array($ability, $abilities, true),
            Response::HTTP_FORBIDDEN,
            'Token sem permissão para esta operação.'
        );

        return $next($request);
    }
}
