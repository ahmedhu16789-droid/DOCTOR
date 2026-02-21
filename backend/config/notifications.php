<?php

use App\Services\Notifications\NotificationEvent;

return [
    'default_channel' => env('NOTIFICATIONS_CHANNEL', 'sms'),
    'default_locale' => env('NOTIFICATIONS_LOCALE', 'en'),

    'templates' => [
        NotificationEvent::APPOINTMENT_CREATED => [
            'en' => [
                'subject' => 'Appointment confirmed',
                'body' => 'Hi {patient_name}, your appointment with Dr. {doctor_name} at {branch_name} is booked for {appointment_datetime}.',
            ],
            'ar' => [
                'subject' => 'تأكيد الحجز',
                'body' => 'مرحباً {patient_name}، تم تأكيد موعدك مع د. {doctor_name} في {branch_name} بتاريخ {appointment_datetime}.',
            ],
        ],
        NotificationEvent::APPOINTMENT_RESCHEDULED => [
            'en' => [
                'subject' => 'Appointment rescheduled',
                'body' => 'Hi {patient_name}, your appointment with Dr. {doctor_name} was moved to {appointment_datetime} at {branch_name}.',
            ],
            'ar' => [
                'subject' => 'إعادة جدولة الموعد',
                'body' => 'مرحباً {patient_name}، تم تغيير موعدك مع د. {doctor_name} إلى {appointment_datetime} في {branch_name}.',
            ],
        ],
        NotificationEvent::APPOINTMENT_CANCELLED => [
            'en' => [
                'subject' => 'Appointment cancelled',
                'body' => 'Hi {patient_name}, your appointment with Dr. {doctor_name} at {branch_name} on {appointment_datetime} has been cancelled.',
            ],
            'ar' => [
                'subject' => 'إلغاء الموعد',
                'body' => 'مرحباً {patient_name}، تم إلغاء موعدك مع د. {doctor_name} في {branch_name} بتاريخ {appointment_datetime}.',
            ],
        ],
        NotificationEvent::APPOINTMENT_NO_SHOW => [
            'en' => [
                'subject' => 'Appointment marked as no-show',
                'body' => 'Hi {patient_name}, your appointment with Dr. {doctor_name} at {branch_name} on {appointment_datetime} was marked as no-show.',
            ],
            'ar' => [
                'subject' => 'تحديث حالة الموعد',
                'body' => 'مرحباً {patient_name}، تم تسجيل موعدك مع د. {doctor_name} في {branch_name} بتاريخ {appointment_datetime} كعدم حضور.',
            ],
        ],
    ],
];
