<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agent extends Model
{
    use HasUuids;

    protected $fillable = [
        'organization_id',
        'name',
        'platform',
        'architecture',
        'version',
        'public_key',
        'session_token_hash',
        'session_expires_at',
        'status',
        'region',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'session_expires_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function presence(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AgentPresence::class);
    }

    public function targets(): HasMany
    {
        return $this->hasMany(TunnelTarget::class);
    }

    public function tunnels(): HasMany
    {
        return $this->hasMany(Tunnel::class);
    }
}
