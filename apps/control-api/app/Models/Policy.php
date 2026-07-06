<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
class Policy extends Model {
 use HasUuids;
 protected $fillable=['organization_id','name','description','enabled','definition','revision'];
 protected function casts(): array { return ['enabled'=>'boolean','definition'=>'array','revision'=>'integer']; }
 public function organization(): BelongsTo { return $this->belongsTo(Organization::class); }
 public function tunnels(): HasMany { return $this->hasMany(Tunnel::class); }
}
