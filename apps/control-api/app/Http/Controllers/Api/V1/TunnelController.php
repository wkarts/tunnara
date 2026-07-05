<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\Agent;
use App\Models\Tunnel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class TunnelController
{
    use ResolvesOrganization;

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            Tunnel::query()
                ->where('organization_id', $this->organizationId($request))
                ->latest()
                ->paginate()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $organizationId = $this->organizationId($request);
        $data = $this->validated($request, $organizationId);
        $tunnel = Tunnel::query()->create($data + [
            'organization_id' => $organizationId,
            'status' => 'pending',
        ]);

        return response()->json($tunnel, Response::HTTP_CREATED);
    }

    public function show(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);

        return response()->json($tunnel);
    }

    public function update(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);
        $tunnel->update($this->validated($request, $tunnel->organization_id, partial: true));

        return response()->json($tunnel->refresh());
    }

    public function destroy(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);
        $tunnel->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    private function validated(Request $request, string $organizationId, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'agent_id' => [
                $required,
                'uuid',
                Rule::exists(Agent::class, 'id')->where(fn ($query) => $query->where('organization_id', $organizationId)),
            ],
            'name' => [$required, 'string', 'max:120'],
            'protocol' => [$required, 'in:http,https,tcp,udp,private_network'],
            'target_host' => [$required, 'string', 'max:255'],
            'target_port' => [$required, 'integer', 'min:1', 'max:65535'],
            'public_hostname' => ['nullable', 'string', 'max:255'],
            'public_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'configuration' => ['nullable', 'array'],
        ]);
    }
}
