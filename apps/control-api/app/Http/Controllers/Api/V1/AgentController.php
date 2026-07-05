<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\Agent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AgentController
{
    use ResolvesOrganization;

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            Agent::query()
                ->where('organization_id', $this->organizationId($request))
                ->latest()
                ->paginate()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'platform' => ['required', 'string', 'max:60'],
            'architecture' => ['required', 'string', 'max:30'],
            'version' => ['required', 'string', 'max:30'],
            'public_key' => ['required', 'string', 'max:4096'],
        ]);

        $agent = Agent::query()->create($data + [
            'organization_id' => $this->organizationId($request),
            'status' => 'provisioning',
        ]);

        return response()->json($agent, Response::HTTP_CREATED);
    }

    public function show(Request $request, Agent $agent): JsonResponse
    {
        $this->authorizeOrganization($request, $agent->organization_id);

        return response()->json($agent);
    }

    public function destroy(Request $request, Agent $agent): JsonResponse
    {
        $this->authorizeOrganization($request, $agent->organization_id);
        $agent->update(['status' => 'revoked']);

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
