<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\Agent;
use App\Models\Tunnel;
use App\Models\TunnelTarget;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class TunnelTargetController
{
    use ResolvesOrganization;

    public function index(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);
        return response()->json(['data' => $tunnel->targets()->orderBy('priority')->get()]);
    }

    public function store(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);
        $data = $this->validated($request, $tunnel->organization_id);
        $target = $tunnel->targets()->create($data + ['organization_id' => $tunnel->organization_id]);
        return response()->json($target, Response::HTTP_CREATED);
    }

    public function update(Request $request, Tunnel $tunnel, TunnelTarget $target): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);
        abort_unless($target->tunnel_id === $tunnel->id, 404, 'Target não encontrado.');
        $target->update($this->validated($request, $tunnel->organization_id, true));
        return response()->json($target->refresh());
    }

    public function destroy(Request $request, Tunnel $tunnel, TunnelTarget $target): JsonResponse
    {
        $this->authorizeOrganization($request, $tunnel->organization_id);
        abort_unless($target->tunnel_id === $tunnel->id, 404, 'Target não encontrado.');
        abort_if($tunnel->targets()->where('enabled',true)->count() <= 1 && $target->enabled, 409, 'O túnel precisa manter ao menos um target habilitado.');
        $target->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    private function validated(Request $request, string $organizationId, bool $partial=false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'agent_id' => [$required,'uuid',Rule::exists(Agent::class,'id')->where(fn ($query) => $query->where('organization_id',$organizationId))],
            'name' => [$required,'string','max:120'], 'target_host' => [$required,'string','max:255'],
            'target_port' => [$required,'integer','min:1','max:65535'], 'weight' => ['sometimes','integer','min:1','max:10000'],
            'priority' => ['sometimes','integer','min:0','max:65535'], 'enabled' => ['sometimes','boolean'], 'health_check' => ['nullable','array'],
        ]);
    }
}
