<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

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

    protected static function booted(): void
    {
        static::creating(function (DoctorEarningsLedger $ledger): void {
            if ($ledger->earning_type === 'ADJUSTMENT' || ! $ledger->doctor_id || ! $ledger->period_month) {
                return;
            }

            $isMonthClosed = DoctorPayrollPeriod::query()
                ->when($ledger->clinic_id, fn (Builder $query) => $query->where('clinic_id', $ledger->clinic_id))
                ->where('doctor_id', $ledger->doctor_id)
                ->where('period_month', $ledger->period_month)
                ->whereNotNull('closed_at')
                ->exists();

            if ($isMonthClosed) {
                throw new RuntimeException('Payroll period is closed. New ledger entries are allowed only as ADJUSTMENT.');
            }
        });
    }

    public function doctor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'doctor_id');
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
