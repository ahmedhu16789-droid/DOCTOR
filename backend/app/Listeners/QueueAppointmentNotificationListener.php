<?php

namespace App\Listeners;

use App\Events\AppointmentNotificationRequested;
use App\Jobs\Notifications\SendAppointmentNotificationJob;

class QueueAppointmentNotificationListener
{
    public function handle(AppointmentNotificationRequested $event): void
    {
        SendAppointmentNotificationJob::dispatch($event->appointment->id, $event->event);
    }
}
