<?php

namespace App\Services\Notifications\Transports;

use Illuminate\Support\Facades\Log;

class SmsLogTransport implements NotificationTransport
{
    public function send(string $recipient, string $message, ?string $subject = null): void
    {
        Log::info('Appointment notification sent via SMS transport.', [
            'recipient' => $recipient,
            'message' => $message,
            'subject' => $subject,
        ]);
    }
}
