<?php

return [
    'delay_detection' => [
        'grace_minutes' => (int) env('APPOINTMENT_DELAY_GRACE_MINUTES', 5),
        'threshold_minutes' => (int) env('APPOINTMENT_DELAY_THRESHOLD_MINUTES', 10),
        'rounding_minutes' => (int) env('APPOINTMENT_DELAY_ROUNDING_MINUTES', 5),
        'mode' => env('APPOINTMENT_DELAY_MODE', 'scheduled_start'), // scheduled_start|expected_end
    ],

    'no_show' => [
        'defaults' => [
            'grace_minutes' => (int) env('NO_SHOW_DEFAULT_GRACE_MINUTES', 30),
            'include_waiting' => (bool) env('NO_SHOW_DEFAULT_INCLUDE_WAITING', false),
            'end_of_day_cutoff_time' => env('NO_SHOW_DEFAULT_EOD_CUTOFF', '18:00:00'),
        ],
    ],
];
