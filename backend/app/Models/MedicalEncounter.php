<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MedicalEncounter extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'clinic_id',
        'appointment_id',
        'patient_id',
        'doctor_id',
        'vitals',
        'exam_findings',
        'diagnosis',
        'plan',
        'next_visit_date',
        'next_visit_type',
        'next_visit_interval',
        'status',
        'finalized_at',
    ];

    protected function casts(): array
    {
        return [
            'vitals' => 'array',
            'next_visit_date' => 'date',
            'next_visit_interval' => 'integer',
            'finalized_at' => 'datetime',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function prescriptions(): HasMany
    {
        return $this->hasMany(Prescription::class);
    }
}
