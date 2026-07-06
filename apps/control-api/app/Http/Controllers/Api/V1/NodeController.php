<?php
namespace App\Http\Controllers\Api\V1;
use App\Models\InfrastructureNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class NodeController {
 public function index(Request $request): JsonResponse {
  $query=InfrastructureNode::query()->orderBy('node_type')->orderBy('region')->orderBy('name');
  if ($request->filled('type')) $query->where('node_type',$request->string('type'));
  return response()->json(['data'=>$query->get()]);
 }
}
