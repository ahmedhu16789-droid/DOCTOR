<?php

use App\Console\Commands\DispatchAutoNoShowCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::resolve(DispatchAutoNoShowCommand::class);

Schedule::command('appointments:no-show:dispatch --mode=time')
    ->everyFiveMinutes()
    ->withoutOverlapping();

Schedule::command('appointments:no-show:dispatch --mode=eod')
    ->hourly()
    ->withoutOverlapping();
