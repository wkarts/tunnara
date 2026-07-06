<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\ServiceToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DistributedControlPlaneTest extends TestCase
{
    use RefreshDatabase;

    private string $adminToken = 'tnr_admin_feature_test';

    protected function setUp(): void
    {
        parent::setUp();
        $organization = Organization::query()->create(['name'=>'Acme','slug'=>'acme','status'=>'active']);
        ServiceToken::query()->create([
            'organization_id'=>$organization->id,'name'=>'test','token_hash'=>hash('sha256',$this->adminToken),
            'abilities'=>['*'],
        ]);
    }

    public function test_provisioning_policy_targets_and_cluster_node(): void
    {
        $headers=['Authorization'=>'Bearer '.$this->adminToken];
        $policy=$this->postJson('/api/v1/policies',[
            'name'=>'Zero Trust','definition'=>['defaultAction'=>'deny','rules'=>[['actions'=>[['type'=>'allow']]]]],
        ],$headers)->assertCreated()->json();

        $provision=$this->postJson('/api/v1/provisioning-tokens',[
            'name'=>'agent-01','expires_in_minutes'=>60,
        ],$headers)->assertCreated()->json();

        $agent=$this->withHeader('X-Tunnara-Provisioning-Token',$provision['token'])->postJson('/api/v1/agents/register',[
            'name'=>'agent-01','platform'=>'linux','architecture'=>'x64','version'=>'2.0.0-rc.1','publicKey'=>str_replace('\\n', "\n", '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAVmQ3VhDzExq5ijILAeaQNXQRpGXDfC2aJALqqNWOFYU=\n-----END PUBLIC KEY-----'),
        ])->assertCreated()->json();

        $tunnel=$this->postJson('/api/v1/tunnels',[
            'agent_id'=>$agent['id'],'policy_id'=>$policy['id'],'name'=>'ERP','protocol'=>'http',
            'target_host'=>'127.0.0.1','target_port'=>8080,'public_hostname'=>'erp.example.test',
            'inspector_enabled'=>true,
        ],$headers)->assertCreated()->json();
        $this->assertCount(1,$tunnel['targets']);

        config(['app.cluster_token'=>'tnr_cluster_feature_test']);
        $cluster=['X-Tunnara-Cluster-Token'=>'tnr_cluster_feature_test'];
        $this->postJson('/api/internal/v1/nodes/register',[
            'nodeType'=>'relay','name'=>'relay-01','region'=>'br-1','publicUrl'=>'tcp://relay.example.test:7300',
        ],$cluster)->assertCreated()->assertJsonPath('node_type','relay');

        $this->getJson('/api/internal/v1/routes/hostname/erp.example.test',$cluster)
            ->assertOk()->assertJsonPath('tunnel.id',$tunnel['id'])->assertJsonPath('target.target_port',8080);
    }
}
