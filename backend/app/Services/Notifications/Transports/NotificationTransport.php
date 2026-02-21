<?php

namespace App\Services\Notifications\Transports;

interface NotificationTransport
{
    public function send(string $recipient, string $message, ?string $subject = null): void;
}
