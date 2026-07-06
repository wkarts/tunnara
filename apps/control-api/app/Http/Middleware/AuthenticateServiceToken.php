<?php

namespace App\Http\Middleware;

use App\Models\Agent;
use App\Models\ServiceToken;
use Closure;
use Illuminate\Http\Request;
use stdClass;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateServiceToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();
        abort_unless(is_string($plainToken) && $plainToken !== '', Response::HTTP_UNAUTHORIZED, 'Token ausente.');
        $hash = hash('sha256', $plainToken);

        $token = ServiceToken::query()->where('token_hash',$hash)->whereNull('revoked_at')->first();
        if ($token && (! $token->expires_at || $token->expires_at->isFuture())) {
            $token->forceFill(['last_used_at'=>now()])->save();
            $request->attributes->set('service_token',$token);
            $request->attributes->set('auth_type','service_token');
            return $next($request);
        }

        $agent = Agent::query()->where('session_token_hash',$hash)->where('status','!=','revoked')->first();
        if ($agent && $agent->session_expires_at?->isFuture()) {
            $agent->forceFill(['last_seen_at'=>now(),'status'=>'online'])->save();
            $principal = new stdClass();
            $principal->organization_id = $agent->organization_id;
            $principal->abilities = ['tunnels:read','tunnels:write','networks:read','networks:write'];
            $principal->agent_id = $agent->id;
            $request->attributes->set('service_token',$principal);
            $request->attributes->set('auth_type','agent');
            $request->attributes->set('agent_id',$agent->id);
            return $next($request);
        }

        abort(Response::HTTP_UNAUTHORIZED,'Token inválido, expirado ou revogado.');
    }
}
