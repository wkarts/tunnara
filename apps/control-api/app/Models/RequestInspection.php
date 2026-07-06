<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
class RequestInspection extends Model {
 use HasUuids; public $timestamps=false;
 protected $fillable=['organization_id','tunnel_id','target_id','method','path','hostname','source_ip','status_code','duration_ms','request_headers','request_body','request_body_truncated','response_headers','response_body','response_body_truncated','metadata','created_at'];
 protected function casts(): array { return ['status_code'=>'integer','duration_ms'=>'integer','request_headers'=>'array','request_body_truncated'=>'boolean','response_headers'=>'array','response_body_truncated'=>'boolean','metadata'=>'array','created_at'=>'datetime']; }
}
