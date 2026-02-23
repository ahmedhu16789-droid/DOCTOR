<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ClinicSubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_id',
        'plan_id',
        'subscription_type',
        'status',
        'starts_at',
        'ends_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function entitlement(): HasOne
    {
        return $this->hasOne(ClinicEntitlement::class);
    }
}
