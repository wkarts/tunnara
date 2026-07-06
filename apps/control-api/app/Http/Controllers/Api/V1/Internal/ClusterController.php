<?php

namespace App\Http\Controllers\Api\V1\Internal;

use App\Models\Agent;
use App\Models\AgentPresence;
use App\Models\InfrastructureNode;
use App\Models\RequestInspection;
use App\Models\Tunnel;
use App\Models\TunnelTarget;
use App\Support\AgentProofVerifier;
use App\Support\RouteResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ClusterController
{
    public function registerNode(Request $request): JsonResponse
    {
        return response()->json($this->upsertNode($request), Response::HTTP_CREATED);
    }

    public function heartbeatNode(Request $request): JsonResponse
    {
        return response()->json($this->upsertNode($request));
    }

    public function authenticateAgent(Request $request, AgentProofVerifier $verifier): JsonResponse
    {
        $data = $request->validate([
            'agentId' => ['required','uuid'], 'sessionToken' => ['required','string','max:512'],
            'timestamp' => ['required','string','max:80'], 'nonce' => ['required','string','max:160'],
            'proof' => ['required','string','max:2048'],
        ]);
        $agent = Agent::query()->find($data['agentId']);
        abort_unless($agent && $verifier->verify($agent,$data), Response::HTTP_UNAUTHORIZED, 'Credencial ou prova criptográfica do agente inválida.');
        return response()->json(['agent' => ['id'=>$agent->id,'organizationId'=>$agent->organization_id,'status'=>$agent->status]]);
    }

    public function presence(Request $request): JsonResponse
    {
        $data = $request->validate([
            'agentId' => ['required','uuid','exists:agents,id'], 'relayNodeId' => ['nullable','uuid','exists:infrastructure_nodes,id'],
            'relayEdgeUrl' => ['nullable','string','max:2048'], 'status' => ['required','in:online,offline'],
        ]);
        $agent = Agent::query()->findOrFail($data['agentId']);
        if ($data['status'] === 'offline') {
            AgentPresence::query()->where('agent_id',$agent->id)
                ->when($data['relayNodeId'] ?? null, fn ($query,$relayId) => $query->where('relay_node_id',$relayId))->delete();
            $agent->update(['status'=>'offline','last_seen_at'=>now()]);
            return response()->json(['status'=>'offline']);
        }
        AgentPresence::query()->updateOrCreate(['agent_id'=>$agent->id],[
            'relay_node_id'=>$data['relayNodeId'] ?? null, 'relay_edge_url'=>$data['relayEdgeUrl'] ?? null,
            'connected_at'=>now(), 'last_seen_at'=>now(),
        ]);
        $agent->update(['status'=>'online','last_seen_at'=>now()]);
        return response()->json(['status'=>'online']);
    }

    public function agentHeartbeat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'agentId' => ['required','uuid','exists:agents,id'], 'relayNodeId' => ['nullable','uuid','exists:infrastructure_nodes,id'],
            'relayEdgeUrl' => ['nullable','string','max:2048'],
        ]);
        Agent::query()->whereKey($data['agentId'])->update(['status'=>'online','last_seen_at'=>now()]);
        if (($data['relayNodeId'] ?? null) || ($data['relayEdgeUrl'] ?? null)) {
            $presence = AgentPresence::query()->firstOrNew(['agent_id'=>$data['agentId']]);
            $presence->fill([
                'relay_node_id'=>$data['relayNodeId'] ?? null,
                'relay_edge_url'=>$data['relayEdgeUrl'] ?? null,
                'last_seen_at'=>now(),
            ]);
            $presence->connected_at ??= now();
            $presence->save();
        }
        return response()->json(['status'=>'ok','serverTime'=>now()->toIso8601String()]);
    }

    public function listTunnels(Request $request, RouteResolver $resolver): JsonResponse
    {
        $protocol = strtolower((string) $request->query('protocol',''));
        $query = Tunnel::query()->where('status','active');
        if ($protocol !== '') $query->where('protocol',$protocol);
        $routes = $query->get()->map(fn (Tunnel $tunnel) => $resolver->resolve($tunnel))->filter(fn ($route) => $route['target'] !== null)->values();
        return response()->json(['data'=>$routes]);
    }

    public function routeByHostname(Request $request, string $hostname, RouteResolver $resolver): JsonResponse
    {
        $route = $resolver->byHostname(strtolower($hostname), $request->query('targetId'));
        return $this->routeResponse($route);
    }

    public function routeByTunnel(Request $request, string $tunnel, RouteResolver $resolver): JsonResponse
    {
        return $this->routeResponse($resolver->byId($tunnel,$request->query('targetId')));
    }

    public function targetHealth(Request $request, TunnelTarget $target): JsonResponse
    {
        $data = $request->validate(['healthy'=>['required','boolean'],'error'=>['nullable','string','max:4000'],'latencyMs'=>['nullable','integer','min:0','max:600000']]);
        $check = is_array($target->health_check) ? $target->health_check : [];
        $healthyThreshold = max(1,(int)($check['healthyThreshold'] ?? $check['healthy_threshold'] ?? 1));
        $unhealthyThreshold = max(1,(int)($check['unhealthyThreshold'] ?? $check['unhealthy_threshold'] ?? 2));
        if ($data['healthy']) {
            $target->consecutive_successes += 1; $target->consecutive_failures = 0;
            if ($target->consecutive_successes >= $healthyThreshold) $target->health_status='healthy';
            $target->last_error=null;
        } else {
            $target->consecutive_failures += 1; $target->consecutive_successes = 0;
            if ($target->consecutive_failures >= $unhealthyThreshold) $target->health_status='unhealthy';
            $target->last_error=$data['error'] ?? 'health_check_failed';
        }
        $target->last_latency_ms=$data['latencyMs'] ?? null; $target->last_checked_at=now(); $target->save();
        $statuses=TunnelTarget::query()->where('tunnel_id',$target->tunnel_id)->where('enabled',true)->pluck('health_status');
        $tunnelStatus=$statuses->contains('healthy')?'healthy':($statuses->contains('unknown')?'unknown':'unhealthy');
        Tunnel::query()->whereKey($target->tunnel_id)->update(['health_status'=>$tunnelStatus]);
        return response()->json($target->refresh());
    }

    public function saveInspection(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id'=>['nullable','uuid'],'organizationId'=>['required','uuid','exists:organizations,id'], 'tunnelId'=>['required','uuid','exists:tunnels,id'],
            'targetId'=>['nullable','uuid','exists:tunnel_targets,id'],'method'=>['required','string','max:16'],'path'=>['required','string','max:8192'],
            'hostname'=>['nullable','string','max:255'],'sourceIp'=>['nullable','ip'],'statusCode'=>['nullable','integer','min:100','max:599'],
            'durationMs'=>['nullable','integer','min:0'],'requestHeaders'=>['nullable','array'],'requestBody'=>['nullable','string'],
            'requestBodyTruncated'=>['nullable','boolean'],'responseHeaders'=>['nullable','array'],'responseBody'=>['nullable','string'],
            'responseBodyTruncated'=>['nullable','boolean'],'metadata'=>['nullable','array'],'createdAt'=>['nullable','date'],
        ]);
        $inspection = RequestInspection::query()->create([
            'id'=>$data['id'] ?? null, 'organization_id'=>$data['organizationId'],'tunnel_id'=>$data['tunnelId'],'target_id'=>$data['targetId'] ?? null,
            'method'=>$data['method'],'path'=>$data['path'],'hostname'=>$data['hostname'] ?? null,'source_ip'=>$data['sourceIp'] ?? null,
            'status_code'=>$data['statusCode'] ?? null,'duration_ms'=>$data['durationMs'] ?? null,'request_headers'=>$data['requestHeaders'] ?? [],
            'request_body'=>$data['requestBody'] ?? null,'request_body_truncated'=>$data['requestBodyTruncated'] ?? false,
            'response_headers'=>$data['responseHeaders'] ?? [],'response_body'=>$data['responseBody'] ?? null,
            'response_body_truncated'=>$data['responseBodyTruncated'] ?? false,'metadata'=>$data['metadata'] ?? [],
            'created_at'=>$data['createdAt'] ?? now(),
        ]);
        return response()->json($inspection,Response::HTTP_CREATED);
    }

    private function upsertNode(Request $request): InfrastructureNode
    {
        $data=$request->validate([
            'id'=>['nullable','uuid'],'nodeType'=>['required','in:control,coordinator,edge,relay'],'name'=>['required','string','max:120'],
            'region'=>['nullable','string','max:80'],'publicUrl'=>['nullable','string','max:2048'],'internalUrl'=>['nullable','string','max:2048'],
            'transport'=>['nullable','string','max:30'],'status'=>['nullable','in:healthy,degraded,offline,draining'],
            'capacity'=>['nullable','integer','min:1','max:10000000'],'activeConnections'=>['nullable','integer','min:0'],'metadata'=>['nullable','array'],
        ]);
        return InfrastructureNode::query()->updateOrCreate(
            ['node_type'=>$data['nodeType'],'name'=>$data['name']],
            ['id'=>$data['id'] ?? null,'region'=>$data['region'] ?? 'default','public_url'=>$data['publicUrl'] ?? null,
             'internal_url'=>$data['internalUrl'] ?? null,'transport'=>$data['transport'] ?? 'tcp','status'=>$data['status'] ?? 'healthy',
             'capacity'=>$data['capacity'] ?? 1000,'active_connections'=>$data['activeConnections'] ?? 0,'metadata'=>$data['metadata'] ?? [],'last_seen_at'=>now()]
        );
    }

    private function routeResponse(?array $route): JsonResponse
    {
        if (! $route) return response()->json(['error'=>'NOT_FOUND','message'=>'Rota não encontrada.'],404);
        if (! $route['target']) return response()->json(['error'=>'NO_HEALTHY_TARGET','message'=>'Nenhum target online ou saudável.'],503);
        return response()->json($route);
    }
}
