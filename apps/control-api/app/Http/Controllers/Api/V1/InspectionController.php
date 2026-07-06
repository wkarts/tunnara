<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\RequestInspection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InspectionController
{
    use ResolvesOrganization;

    public function index(Request $request): JsonResponse
    {
        $organizationId = $this->organizationId($request);
        $query = RequestInspection::query()->where('organization_id',$organizationId)->latest('created_at');
        if ($request->filled('tunnelId')) $query->where('tunnel_id',$request->string('tunnelId'));
        return response()->json($query->paginate(min(100,max(1,$request->integer('perPage',30)))));
    }

    public function show(Request $request, RequestInspection $inspection): JsonResponse
    {
        $this->authorizeOrganization($request, $inspection->organization_id);
        return response()->json($inspection);
    }

    public function destroy(Request $request, RequestInspection $inspection): JsonResponse
    {
        $this->authorizeOrganization($request, $inspection->organization_id);
        $inspection->delete();
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    public function purge(Request $request): JsonResponse
    {
        $data = $request->validate(['older_than_days' => ['nullable','integer','min:0','max:3650']]);
        $query = RequestInspection::query()->where('organization_id',$this->organizationId($request));
        if (($data['older_than_days'] ?? 0) > 0) $query->where('created_at','<',now()->subDays($data['older_than_days']));
        return response()->json(['deleted' => $query->delete()]);
    }
}
