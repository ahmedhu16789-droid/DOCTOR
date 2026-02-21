<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use BelongsToTenant, HasFactory;

    public const LIFECYCLE_DRAFT = 'DRAFT';
    public const LIFECYCLE_FINALIZED = 'FINALIZED';
    public const LIFECYCLE_VOIDED = 'VOIDED';

    public const BILLING_UNPAID = 'UNPAID';
    public const BILLING_PARTIAL = 'PARTIAL';
    public const BILLING_PAID = 'PAID';

    public const ALLOWED_LIFECYCLE_STATES = [
        self::LIFECYCLE_DRAFT,
        self::LIFECYCLE_FINALIZED,
        self::LIFECYCLE_VOIDED,
    ];

    protected $fillable = [
        'clinic_id',
        'appointment_id',
        'total',
        'paid_amount',
        'status',
        'lifecycle_state',
    ];

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(FinancialAuditLog::class, 'invoice_id');
    }

    public function canMutateFinancials(): bool
    {
        return $this->currentLifecycleState() === self::LIFECYCLE_DRAFT;
    }

    public function canFinalize(): bool
    {
        return $this->currentLifecycleState() === self::LIFECYCLE_DRAFT;
    }

    public function canReverseFinalization(): bool
    {
        return $this->currentLifecycleState() === self::LIFECYCLE_FINALIZED;
    }

    public function canVoid(): bool
    {
        return $this->currentLifecycleState() !== self::LIFECYCLE_VOIDED;
    }

    public function currentLifecycleState(): string
    {
        return $this->lifecycle_state ?: self::LIFECYCLE_DRAFT;
    }
}
