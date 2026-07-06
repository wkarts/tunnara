<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\ProvisioningToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class ProvisioningTokenController
{
    use ResolvesOrganization;

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => ProvisioningToken::query()->where('organization_id', $this->organizationId($request))->latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required','string','max:120'], 'expires_in_minutes' => ['nullable','integer','min:5','max:10080']]);
        $plain = 'tnr_prov_'.Str::random(64);
        $token = ProvisioningToken::query()->create([
            'organization_id' => $this->organizationId($request),
            'name' => $data['name'],
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addMinutes((int) ($data['expires_in_minutes'] ?? 60)),
        ]);
        return response()->json(['token' => $plain, 'provisioningToken' => $token], Response::HTTP_CREATED);
    }

    public function destroy(Request $request, ProvisioningToken $provisioningToken): JsonResponse
    {
        $this->authorizeOrganization($request, $provisioningToken->organization_id);
        $provisioningToken->update(['revoked_at' => now()]);
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
