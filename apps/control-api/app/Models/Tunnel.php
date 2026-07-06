<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tunnel extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id',
        'agent_id',
        'policy_id',
        'name',
        'protocol',
        'target_host',
        'target_port',
        'public_hostname',
        'public_port',
        'status',
        'configuration',
        'inspector_enabled',
        'inspector_body_limit',
        'health_status',
    ];

    protected function casts(): array
    {
        return [
            'configuration' => 'array',
            'target_port' => 'integer',
            'public_port' => 'integer',
            'inspector_enabled' => 'boolean',
            'inspector_body_limit' => 'integer',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(Policy::class);
    }

    public function targets(): HasMany
    {
        return $this->hasMany(TunnelTarget::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }
}
