<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Prescription extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'clinic_id',
        'medical_encounter_id',
        'medication_name',
        'active_ingredient',
        'dosage',
        'frequency',
        'duration',
        'instructions',
    ];

    public function encounter(): BelongsTo
    {
        return $this->belongsTo(MedicalEncounter::class, 'medical_encounter_id');
    }
}
