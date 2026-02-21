<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReconciliationSummary extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'clinic_id',
        'branch_id',
        'cash_session_id',
        'closed_by',
        'reconciliation_date',
        'opening_balance',
        'expected_cash',
        'collected_cash',
        'variance',
    ];

    protected function casts(): array
    {
        return [
            'reconciliation_date' => 'date',
            'opening_balance' => 'float',
            'expected_cash' => 'float',
            'collected_cash' => 'float',
            'variance' => 'float',
        ];
    }

    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
