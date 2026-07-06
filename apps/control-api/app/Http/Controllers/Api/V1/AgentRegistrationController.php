<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Agent;
use App\Models\InfrastructureNode;
use App\Models\ProvisioningToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AgentRegistrationController
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required','string','max:120'], 'platform' => ['required','string','max:60'],
            'architecture' => ['required','string','max:30'], 'version' => ['required','string','max:30'],
            'publicKey' => ['required','string','max:4096'],
        ]);
        $plainProvisioning = (string) ($request->header('X-Tunnara-Provisioning-Token') ?: $request->input('provisioningToken'));
        abort_unless($plainProvisioning !== '', Response::HTTP_UNAUTHORIZED, 'Token de provisionamento obrigatório.');
        $publicKey = openssl_pkey_get_public($data['publicKey']);
        $details = $publicKey ? openssl_pkey_get_details($publicKey) : false;
        abort_unless($publicKey !== false && is_array($details) && ($details['type'] ?? null) === OPENSSL_KEYTYPE_ED25519, 422, 'Chave pública Ed25519 PEM inválida.');

        $result = DB::transaction(function () use ($plainProvisioning, $data): array {
            $token = ProvisioningToken::query()->lockForUpdate()->where('token_hash', hash('sha256', $plainProvisioning))->first();
            abort_unless($token && ! $token->used_at && ! $token->revoked_at && $token->expires_at->isFuture(), Response::HTTP_UNAUTHORIZED, 'Token de provisionamento inválido, expirado ou utilizado.');
            $sessionToken = 'tnr_agent_'.Str::random(72);
            $agent = Agent::query()->create([
                'organization_id' => $token->organization_id,
                'name' => $data['name'], 'platform' => $data['platform'], 'architecture' => $data['architecture'],
                'version' => $data['version'], 'public_key' => $data['publicKey'],
                'session_token_hash' => hash('sha256', $sessionToken), 'session_expires_at' => now()->addDays(90),
                'status' => 'offline', 'last_seen_at' => now(),
            ]);
            $token->update(['used_at' => now()]);
            return [$agent, $sessionToken];
        });

        [$agent, $sessionToken] = $result;
        $relayUrls = InfrastructureNode::query()->where('node_type','relay')->where('status','healthy')->whereNotNull('public_url')
            ->orderByRaw('active_connections / CASE WHEN capacity < 1 THEN 1 ELSE capacity END')->pluck('public_url')->all();
        if ($relayUrls === []) $relayUrls[] = (string) config('app.public_relay_url');

        return response()->json([
            'id' => $agent->id, 'organizationId' => $agent->organization_id, 'sessionToken' => $sessionToken,
            'controlUrl' => config('app.public_control_url'), 'relayUrl' => $relayUrls[0], 'relayUrls' => $relayUrls,
        ], Response::HTTP_CREATED);
    }
}
