<?php

namespace App\Services\Notifications;

class NotificationEvent
{
    public const APPOINTMENT_CREATED = 'APPOINTMENT_CREATED';
    public const APPOINTMENT_RESCHEDULED = 'APPOINTMENT_RESCHEDULED';
    public const APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED';
    public const APPOINTMENT_NO_SHOW = 'APPOINTMENT_NO_SHOW';
}
