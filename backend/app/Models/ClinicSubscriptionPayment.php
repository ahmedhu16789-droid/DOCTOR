<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicSubscriptionPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_subscription_id',
        'payment_kind',
        'period_years',
        'amount',
        'paid_at',
        'recorded_by',
        'notes',
        'receipt_ref',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'amount' => 'decimal:2',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(ClinicSubscription::class, 'clinic_subscription_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
