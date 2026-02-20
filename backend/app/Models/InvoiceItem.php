<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    use BelongsToTenant, HasFactory;

    public const CATEGORY_CONSULTATION = 'CONSULTATION';
    public const CATEGORY_PROCEDURE = 'PROCEDURE';
    public const CATEGORY_LAB = 'LAB';
    public const CATEGORY_SUPPLY = 'SUPPLY';

    public const ALLOWED_CATEGORIES = [
        self::CATEGORY_CONSULTATION,
        self::CATEGORY_PROCEDURE,
        self::CATEGORY_LAB,
        self::CATEGORY_SUPPLY,
    ];

    protected $fillable = [
        'clinic_id',
        'invoice_id',
        'service_id',
        'name',
        'category',
        'quantity',
        'unit_price',
        'total',
        'added_by',
    ];

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
