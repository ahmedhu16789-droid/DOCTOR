<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use BelongsToTenant;
    use HasApiTokens;
    use HasFactory;
    use HasRoles;
    use Notifiable;

    protected $fillable = [
        'clinic_id',
        'is_platform_admin',
        'name',
        'email',
        'phone',
        'password',
        'role',
        'job_title',
        'specialty',
        'consultation_fee',
        'schedule',
        'payroll',
        'exam_finding_templates',
        'diagnosis_templates',
        'plan_templates',
        'doctor_advanced_mode_enabled',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'consultation_fee' => 'decimal:2',
            'schedule' => 'array',
            'payroll' => 'array',
            'exam_finding_templates' => 'array',
            'diagnosis_templates' => 'array',
            'plan_templates' => 'array',
            'doctor_advanced_mode_enabled' => 'boolean',
            'is_platform_admin' => 'boolean',
        ];
    }


    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class)->withTimestamps()->withPivot('clinic_id');
    }

    public function payrollContracts(): HasMany
    {
        return $this->hasMany(DoctorPayrollContract::class, 'doctor_id');
    }
}
