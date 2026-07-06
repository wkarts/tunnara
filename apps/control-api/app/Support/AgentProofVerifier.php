<?php

namespace App\Support;

use App\Models\Agent;
use Illuminate\Support\Facades\DB;

class AgentProofVerifier
{
    public function verify(Agent $agent, array $hello): bool
    {
        $sessionToken = (string) ($hello['sessionToken'] ?? '');
        $timestamp = (string) ($hello['timestamp'] ?? '');
        $nonce = (string) ($hello['nonce'] ?? '');
        $proof = base64_decode((string) ($hello['proof'] ?? ''), true);
        $timestampSeconds = strtotime($timestamp);

        if ($sessionToken === '' || $timestampSeconds === false || abs(time() - $timestampSeconds) > 60) {
            return false;
        }
        if (! preg_match('/^[A-Za-z0-9_-]{24,160}$/', $nonce) || ! is_string($proof)) {
            return false;
        }
        if (! hash_equals((string) $agent->session_token_hash, hash('sha256', $sessionToken))) {
            return false;
        }
        if (! $agent->session_expires_at || $agent->session_expires_at->isPast() || $agent->status === 'revoked') {
            return false;
        }

        $message = "TUNNARA_AGENT_AUTH_V1\n{$agent->id}\n{$timestamp}\n{$nonce}\n{$sessionToken}";
        if (openssl_verify($message, $proof, $agent->public_key, 0) !== 1) {
            return false;
        }

        return DB::transaction(function () use ($agent, $nonce): bool {
            DB::table('agent_auth_nonces')->where('expires_at', '<=', now())->delete();
            try {
                DB::table('agent_auth_nonces')->insert([
                    'agent_id' => $agent->id,
                    'nonce' => $nonce,
                    'expires_at' => now()->addMinutes(2),
                ]);
                return true;
            } catch (\Throwable) {
                return false;
            }
        });
    }
}
