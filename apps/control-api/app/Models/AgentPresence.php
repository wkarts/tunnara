<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class AgentPresence extends Model {
 protected $table='agent_presence'; public $incrementing=false; protected $primaryKey='agent_id'; protected $keyType='string';
 protected $fillable=['agent_id','relay_node_id','relay_edge_url','connected_at','last_seen_at'];
 protected function casts(): array { return ['connected_at'=>'datetime','last_seen_at'=>'datetime']; }
 public function agent(): BelongsTo { return $this->belongsTo(Agent::class); }
 public function relay(): BelongsTo { return $this->belongsTo(InfrastructureNode::class,'relay_node_id'); }
}
