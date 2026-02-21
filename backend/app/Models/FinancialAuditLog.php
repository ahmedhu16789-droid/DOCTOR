<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialAuditLog extends Model
{
    use BelongsToTenant, HasFactory;

    protected $fillable = [
        'clinic_id',
        'invoice_id',
        'actor_id',
        'action_type',
        'target_entity_type',
        'target_entity_id',
        'before_snapshot',
        'after_snapshot',
        'reason',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'before_snapshot' => 'array',
            'after_snapshot' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
