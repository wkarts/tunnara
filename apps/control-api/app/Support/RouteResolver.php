<?php

namespace App\Support;

use App\Models\Tunnel;
use App\Models\TunnelTarget;

class RouteResolver
{
    public function byHostname(string $hostname, ?string $targetId = null): ?array
    {
        $tunnel = Tunnel::query()->where('public_hostname', strtolower($hostname))->where('status', 'active')->first();
        return $tunnel ? $this->resolve($tunnel, $targetId) : null;
    }

    public function byId(string $id, ?string $targetId = null): ?array
    {
        $tunnel = Tunnel::query()->whereKey($id)->where('status', 'active')->first();
        return $tunnel ? $this->resolve($tunnel, $targetId) : null;
    }

    public function resolve(Tunnel $tunnel, ?string $targetId = null): array
    {
        $query = TunnelTarget::query()
            ->where('tunnel_id', $tunnel->id)
            ->where('enabled', true)
            ->with('agent.presence');

        if ($targetId) {
            $query->whereKey($targetId);
        }

        $targets = $query->orderBy('priority')->get();
        $healthy = $targets->where('health_status', 'healthy');
        $candidates = $healthy->isNotEmpty() ? $healthy : $targets->where('health_status', 'unknown');
        if ($candidates->isEmpty()) {
            return ['tunnel' => $tunnel, 'target' => null, 'presence' => null];
        }

        $minimumPriority = $candidates->min('priority');
        $candidates = $candidates->where('priority', $minimumPriority)->values();
        $totalWeight = max(1, (int) $candidates->sum(fn (TunnelTarget $target) => max(1, $target->weight)));
        $pick = random_int(1, $totalWeight);
        $selected = $candidates->first();
        foreach ($candidates as $candidate) {
            $pick -= max(1, (int) $candidate->weight);
            if ($pick <= 0) { $selected = $candidate; break; }
        }

        return [
            'tunnel' => $tunnel->loadMissing('policy'),
            'target' => $selected,
            'presence' => $selected?->agent?->presence,
        ];
    }
}
