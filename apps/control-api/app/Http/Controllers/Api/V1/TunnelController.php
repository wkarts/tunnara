<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Api\V1\Concerns\ResolvesOrganization;
use App\Models\Agent;
use App\Models\Policy;
use App\Models\Tunnel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class TunnelController
{
    use ResolvesOrganization;

    public function index(Request $request): JsonResponse
    {
        $query = Tunnel::query()->with(['targets','policy'])->where('organization_id',$this->organizationId($request));
        if ($request->attributes->get('agent_id')) $query->where('agent_id',$request->attributes->get('agent_id'));
        return response()->json($query->latest()->paginate());
    }

    public function store(Request $request): JsonResponse
    {
        $organizationId=$this->organizationId($request); $data=$this->validated($request,$organizationId);
        if ($request->attributes->get('agent_id')) {
            $data['agent_id']=$request->attributes->get('agent_id');
            if (isset($data['targets'])) foreach ($data['targets'] as &$target) $target['agent_id']=$data['agent_id'];
        }
        $tunnel=DB::transaction(function () use ($data,$organizationId): Tunnel {
            $targets=$data['targets'] ?? null; unset($data['targets']);
            $tunnel=Tunnel::query()->create($data+['organization_id'=>$organizationId,'status'=>'active','health_status'=>'unknown']);
            $targets ??= [[
                'agent_id'=>$data['agent_id'],'name'=>'default','target_host'=>$data['target_host'],'target_port'=>$data['target_port'],
                'weight'=>1,'priority'=>100,'enabled'=>true,'health_check'=>$data['configuration']['healthCheck'] ?? [],
            ]];
            foreach ($targets as $target) $tunnel->targets()->create($target+['organization_id'=>$organizationId]);
            return $tunnel;
        });
        return response()->json($tunnel->load(['targets','policy']),Response::HTTP_CREATED);
    }

    public function show(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeTunnelAccess($request,$tunnel);
        return response()->json($tunnel->load(['targets','policy']));
    }

    public function update(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeTunnelAccess($request,$tunnel);
        $data=$this->validated($request,$tunnel->organization_id,true);
        DB::transaction(function () use ($tunnel,$data): void {
            $targets=$data['targets'] ?? null; unset($data['targets']); $tunnel->update($data);
            if (is_array($targets)) {
                $ids=[];
                foreach ($targets as $targetData) {
                    $id=$targetData['id'] ?? null; unset($targetData['id']);
                    $target=$id ? $tunnel->targets()->whereKey($id)->first() : null;
                    if ($target) $target->update($targetData); else $target=$tunnel->targets()->create($targetData+['organization_id'=>$tunnel->organization_id]);
                    $ids[]=$target->id;
                }
                abort_if($ids===[],422,'O túnel precisa de ao menos um target.');
                $tunnel->targets()->whereNotIn('id',$ids)->delete();
            }
        });
        return response()->json($tunnel->refresh()->load(['targets','policy']));
    }

    public function destroy(Request $request, Tunnel $tunnel): JsonResponse
    {
        $this->authorizeTunnelAccess($request,$tunnel); $tunnel->delete();
        return response()->json(null,Response::HTTP_NO_CONTENT);
    }

    private function authorizeTunnelAccess(Request $request, Tunnel $tunnel): void
    {
        $this->authorizeOrganization($request,$tunnel->organization_id);
        $agentId=$request->attributes->get('agent_id');
        abort_if($agentId && $tunnel->agent_id !== $agentId,404,'Recurso não encontrado.');
    }

    private function validated(Request $request,string $organizationId,bool $partial=false): array
    {
        $required=$partial?'sometimes':'required';
        return $request->validate([
            'agent_id'=>[$required,'uuid',Rule::exists(Agent::class,'id')->where(fn($q)=>$q->where('organization_id',$organizationId))],
            'policy_id'=>['nullable','uuid',Rule::exists(Policy::class,'id')->where(fn($q)=>$q->where('organization_id',$organizationId))],
            'name'=>[$required,'string','max:120'],'protocol'=>[$required,'in:http,https,tcp,udp,private_network'],
            'target_host'=>[$required,'string','max:255'],'target_port'=>[$required,'integer','min:1','max:65535'],
            'public_hostname'=>['nullable','string','max:255'],'public_port'=>['nullable','integer','min:1','max:65535'],
            'status'=>['sometimes','in:pending,active,disabled,error'],'configuration'=>['nullable','array'],
            'inspector_enabled'=>['sometimes','boolean'],'inspector_body_limit'=>['sometimes','integer','min:0','max:10485760'],
            'targets'=>['sometimes','array','min:1','max:64'],'targets.*.id'=>['sometimes','uuid'],
            'targets.*.agent_id'=>['required_with:targets','uuid',Rule::exists(Agent::class,'id')->where(fn($q)=>$q->where('organization_id',$organizationId))],
            'targets.*.name'=>['required_with:targets','string','max:120'],'targets.*.target_host'=>['required_with:targets','string','max:255'],
            'targets.*.target_port'=>['required_with:targets','integer','min:1','max:65535'],'targets.*.weight'=>['sometimes','integer','min:1','max:10000'],
            'targets.*.priority'=>['sometimes','integer','min:0','max:65535'],'targets.*.enabled'=>['sometimes','boolean'],'targets.*.health_check'=>['nullable','array'],
        ]);
    }
}
