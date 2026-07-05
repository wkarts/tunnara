<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tunnel extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id',
        'agent_id',
        'name',
        'protocol',
        'target_host',
        'target_port',
        'public_hostname',
        'public_port',
        'status',
        'configuration',
    ];

    protected function casts(): array
    {
        return [
            'configuration' => 'array',
            'target_port' => 'integer',
            'public_port' => 'integer',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class);
    }
}
