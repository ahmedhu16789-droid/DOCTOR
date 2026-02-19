<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoctorEarningsLedger extends Model
{
    use BelongsToTenant, HasFactory;

    protected $table = 'doctor_earnings_ledger';

    protected $fillable = [
        'clinic_id',
        'doctor_id',
        'appointment_id',
        'invoice_id',
        'transaction_id',
        'period_month',
        'earning_type',
        'basis_amount',
        'rate',
        'amount',
        'currency',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'basis_amount' => 'decimal:2',
            'rate' => 'decimal:4',
            'amount' => 'decimal:2',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
