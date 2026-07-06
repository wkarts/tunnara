<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
class ProvisioningToken extends Model {
 use HasUuids;
 protected $fillable=['organization_id','name','token_hash','expires_at','used_at','revoked_at'];
 protected $hidden=['token_hash'];
 protected function casts(): array { return ['expires_at'=>'datetime','used_at'=>'datetime','revoked_at'=>'datetime']; }
 public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
}
