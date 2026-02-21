<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Laravel\Sanctum\HasApiTokens;
use App\Models\Appointment;

class Patient extends Authenticatable
{
    use BelongsToTenant, HasApiTokens, HasFactory;

    protected $fillable = [
        'clinic_id',
        'name',
        'phone',
        'gender',
        'age',
        'medical_history_summary',
        'portal_password',
    ];

    protected $hidden = [
        'portal_password',
    ];

    protected function casts(): array
    {
        return [
            'portal_password' => 'hashed',
        ];
    }

    public function appointments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Appointment::class);
    }
}
