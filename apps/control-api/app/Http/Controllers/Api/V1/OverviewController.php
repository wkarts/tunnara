<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\Agent;
use App\Models\Tunnel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OverviewController
{
    use ResolvesOrganization;

    public function __invoke(Request $request): JsonResponse
    {
        $organizationId = $this->organizationId($request);

        return response()->json([
            'agentsOnline' => Agent::query()->where('organization_id', $organizationId)->where('status', 'online')->count(),
            'tunnelsActive' => Tunnel::query()->where('organization_id', $organizationId)->where('status', 'active')->count(),
            'edgeNodesHealthy' => 0,
            'activeConnections' => 0,
            'trafficTodayGb' => 0.0,
            'alerts' => 0,
        ]);
    }
}
