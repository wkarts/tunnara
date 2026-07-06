<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class TunnelTarget extends Model {
 use HasUuids;
 protected $fillable=['organization_id','tunnel_id','agent_id','name','target_host','target_port','weight','priority','enabled','health_status','consecutive_successes','consecutive_failures','last_latency_ms','last_checked_at','last_error','health_check'];
 protected function casts(): array { return ['target_port'=>'integer','weight'=>'integer','priority'=>'integer','enabled'=>'boolean','consecutive_successes'=>'integer','consecutive_failures'=>'integer','last_latency_ms'=>'integer','last_checked_at'=>'datetime','health_check'=>'array']; }
 public function tunnel(): BelongsTo { return $this->belongsTo(Tunnel::class); }
 public function agent(): BelongsTo { return $this->belongsTo(Agent::class); }
 public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
}
