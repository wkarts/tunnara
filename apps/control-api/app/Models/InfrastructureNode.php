<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class InfrastructureNode extends Model {
 use HasUuids;
 protected $fillable=['node_type','name','region','public_url','internal_url','transport','status','capacity','active_connections','metadata','last_seen_at'];
 protected function casts(): array { return ['capacity'=>'integer','active_connections'=>'integer','metadata'=>'array','last_seen_at'=>'datetime']; }
}
