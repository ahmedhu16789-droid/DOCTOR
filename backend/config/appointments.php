<?php

return [
    'no_show' => [
        'defaults' => [
            'grace_minutes' => (int) env('NO_SHOW_DEFAULT_GRACE_MINUTES', 30),
            'include_waiting' => (bool) env('NO_SHOW_DEFAULT_INCLUDE_WAITING', false),
            'end_of_day_cutoff_time' => env('NO_SHOW_DEFAULT_EOD_CUTOFF', '18:00:00'),
        ],
    ],
];
