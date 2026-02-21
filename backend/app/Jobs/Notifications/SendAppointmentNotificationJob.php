<?php

namespace App\Jobs\Notifications;

use App\Models\Appointment;
use App\Services\Notifications\AppointmentNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class SendAppointmentNotificationJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [30, 120, 300];

    public function __construct(
        public int $appointmentId,
        public string $event,
    ) {
    }

    public function handle(AppointmentNotificationService $service): void
    {
        $appointment = Appointment::query()->find($this->appointmentId);

        if (! $appointment) {
            return;
        }

        $service->send($appointment, $this->event);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Appointment notification job failed after retries.', [
            'appointment_id' => $this->appointmentId,
            'event' => $this->event,
            'error' => $exception->getMessage(),
        ]);
    }
}
