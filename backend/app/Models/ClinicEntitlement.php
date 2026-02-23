<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicEntitlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_id',
        'clinic_subscription_id',
        'max_branches',
        'max_doctors',
        'max_staff',
        'max_patients_per_month',
    ];

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function clinicSubscription(): BelongsTo
    {
        return $this->belongsTo(ClinicSubscription::class);
    }
}
