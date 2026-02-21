<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentNotificationLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_id',
        'appointment_id',
        'event',
        'channel',
        'locale',
        'recipient',
        'status',
        'attempts',
        'queued_at',
        'sent_at',
        'failed_at',
        'error_message',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'queued_at' => 'datetime',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}
