<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\Policy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class PolicyController
{
    use ResolvesOrganization;

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => Policy::query()->where('organization_id', $this->organizationId($request))->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $organizationId = $this->organizationId($request);
        $data = $request->validate([
            'name' => ['required','string','max:120',Rule::unique('policies')->where(fn ($query) => $query->where('organization_id',$organizationId))],
            'description' => ['nullable','string','max:2000'], 'enabled' => ['sometimes','boolean'],
            'definition' => ['required','array'], 'definition.rules' => ['required','array','max:200'],
        ]);
        $policy = Policy::query()->create($data + ['organization_id' => $organizationId, 'enabled' => $data['enabled'] ?? true]);
        return response()->json($policy, Response::HTTP_CREATED);
    }

    public function show(Request $request, Policy $policy): JsonResponse
    {
        $this->authorizeOrganization($request, $policy->organization_id);
        return response()->json($policy);
    }

    public function update(Request $request, Policy $policy): JsonResponse
    {
        $this->authorizeOrganization($request, $policy->organization_id);
        $data = $request->validate([
            'name' => ['sometimes','string','max:120',Rule::unique('policies')->ignore($policy)->where(fn ($query) => $query->where('organization_id',$policy->organization_id))],
            'description' => ['nullable','string','max:2000'], 'enabled' => ['sometimes','boolean'],
            'definition' => ['sometimes','array'], 'definition.rules' => ['sometimes','array','max:200'],
        ]);
        if (array_key_exists('definition', $data)) $data['revision'] = $policy->revision + 1;
        $policy->update($data);
        return response()->json($policy->refresh());
    }

    public function destroy(Request $request, Policy $policy): JsonResponse
    {
        $this->authorizeOrganization($request, $policy->organization_id);
        abort_if($policy->tunnels()->exists(), 409, 'A política está vinculada a túneis.');
        $policy->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
