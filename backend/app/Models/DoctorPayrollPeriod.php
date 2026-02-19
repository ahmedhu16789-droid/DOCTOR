<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DoctorPayrollPeriod extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'clinic_id',
        'doctor_id',
        'period_month',
        'total_earned',
        'total_adjustments',
        'total_settled',
        'status',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'total_earned' => 'decimal:2',
            'total_adjustments' => 'decimal:2',
            'total_settled' => 'decimal:2',
            'closed_at' => 'datetime',
        ];
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(DoctorPayrollSettlement::class, 'period_id');
    }
}
