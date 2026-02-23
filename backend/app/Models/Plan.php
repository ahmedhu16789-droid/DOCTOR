<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'description',
        'default_limits',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'default_limits' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function clinicSubscriptions(): HasMany
    {
        return $this->hasMany(ClinicSubscription::class);
    }
}
