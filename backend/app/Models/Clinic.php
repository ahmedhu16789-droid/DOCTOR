<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Clinic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'subscription_status',
        'settings',
        'public_uuid',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(ClinicSubscription::class);
    }

    public function activeSubscription(): HasOne
    {
        return $this->hasOne(ClinicSubscription::class)
            ->where('starts_at', '<=', now())
            ->where(function ($query): void {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->latestOfMany('starts_at');
    }

    protected static function booted(): void
    {
        static::creating(function (Clinic $clinic): void {
            if (! $clinic->public_uuid) {
                $clinic->public_uuid = (string) Str::uuid();
            }
        });
    }
}
