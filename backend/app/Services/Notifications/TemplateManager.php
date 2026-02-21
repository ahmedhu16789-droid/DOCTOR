<?php

namespace App\Services\Notifications;

use App\Models\Appointment;
use App\Models\NotificationTemplate;

class TemplateManager
{
    public function resolve(Appointment $appointment, string $event, string $channel, string $locale): array
    {
        $template = NotificationTemplate::query()
            ->where('channel', $channel)
            ->where('event', $event)
            ->where('locale', $locale)
            ->where('is_active', true)
            ->where(function ($query) use ($appointment): void {
                $query->where('clinic_id', $appointment->clinic_id)->orWhereNull('clinic_id');
            })
            ->orderByRaw('clinic_id is null')
            ->first();

        $defaults = config("notifications.templates.{$event}.{$locale}");

        return [
            'subject' => (string) ($template?->subject ?? ($defaults['subject'] ?? '')),
            'body' => (string) ($template?->body ?? ($defaults['body'] ?? '')),
        ];
    }

    public function render(string $content, array $placeholders): string
    {
        $replacements = [];

        foreach ($placeholders as $key => $value) {
            $replacements['{'.$key.'}'] = (string) $value;
        }

        return strtr($content, $replacements);
    }
}
