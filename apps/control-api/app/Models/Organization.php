<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasUuids;

    protected $fillable = [
        'name',
        'slug',
        'status',
    ];

    public function agents(): HasMany
    {
        return $this->hasMany(Agent::class);
    }

    public function tunnels(): HasMany
    {
        return $this->hasMany(Tunnel::class);
    }


    public function policies(): HasMany
    {
        return $this->hasMany(Policy::class);
    }

    public function provisioningTokens(): HasMany
    {
        return $this->hasMany(ProvisioningToken::class);
    }

    public function serviceTokens(): HasMany
    {
        return $this->hasMany(ServiceToken::class);
    }
}
