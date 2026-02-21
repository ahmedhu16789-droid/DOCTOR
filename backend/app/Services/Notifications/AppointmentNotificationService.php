<?php

namespace App\Services\Notifications;

use App\Models\Appointment;
use App\Models\AppointmentNotificationLog;
use App\Services\Notifications\Transports\NotificationTransport;

class AppointmentNotificationService
{
    public function __construct(
        private readonly TemplateManager $templateManager,
        private readonly NotificationTransport $transport,
    ) {
    }

    public function send(Appointment $appointment, string $event): AppointmentNotificationLog
    {
        $appointment->loadMissing(['patient:id,name,phone', 'doctor:id,name', 'branch:id,name']);

        $locale = (string) data_get($appointment->clinic?->settings, 'locale', config('notifications.default_locale', 'en'));
        $channel = (string) config('notifications.default_channel', 'sms');

        $log = AppointmentNotificationLog::query()->create([
            'clinic_id' => $appointment->clinic_id,
            'appointment_id' => $appointment->id,
            'event' => $event,
            'channel' => $channel,
            'locale' => $locale,
            'recipient' => $appointment->patient?->phone,
            'status' => 'QUEUED',
            'queued_at' => now(),
        ]);

        $recipient = (string) ($appointment->patient?->phone ?? '');
        if ($recipient === '') {
            return tap($log)->update([
                'status' => 'SKIPPED',
                'failed_at' => now(),
                'error_message' => 'Missing patient phone number.',
                'attempts' => 1,
            ]);
        }

        $template = $this->templateManager->resolve($appointment, $event, $channel, $locale);

        $scheduledAt = $appointment->date?->format('Y-m-d').' '.$appointment->time_slot;
        $placeholders = [
            'patient_name' => $appointment->patient?->name ?? 'Patient',
            'doctor_name' => $appointment->doctor?->name ?? 'Doctor',
            'branch_name' => $appointment->branch?->name ?? 'Branch',
            'appointment_datetime' => trim((string) $scheduledAt),
        ];

        try {
            $subject = $this->templateManager->render($template['subject'], $placeholders);
            $body = $this->templateManager->render($template['body'], $placeholders);
            $this->transport->send($recipient, $body, $subject);

            $log->update([
                'status' => 'SENT',
                'sent_at' => now(),
                'attempts' => $log->attempts + 1,
                'payload' => ['subject' => $subject, 'body' => $body],
                'error_message' => null,
            ]);
        } catch (\Throwable $exception) {
            $log->update([
                'status' => 'FAILED',
                'failed_at' => now(),
                'attempts' => $log->attempts + 1,
                'error_message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        return $log->fresh();
    }
}
