<?php

namespace App\Providers;

use App\Events\AppointmentNotificationRequested;
use App\Listeners\QueueAppointmentNotificationListener;
use App\Services\Notifications\Transports\NotificationTransport;
use App\Services\Notifications\Transports\SmsLogTransport;
use Illuminate\Support\Facades\Event;
use App\Models\Appointment;
use App\Policies\AppointmentPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(NotificationTransport::class, SmsLogTransport::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(AppointmentNotificationRequested::class, QueueAppointmentNotificationListener::class);
        Gate::policy(Appointment::class, AppointmentPolicy::class);

        RateLimiter::for('public-booking', function (Request $request): Limit {
            $ip = $request->ip() ?: 'unknown';
            $clinicPublicId = (string) $request->query('clinicPublicId', $request->input('clinicPublicId', 'none'));

            return Limit::perMinute(60)
                ->by($ip.'|'.$clinicPublicId)
                ->response(function () use ($ip, $clinicPublicId) {
                    Log::warning('Public booking rate limit exceeded.', [
                        'ip' => $ip,
                        'clinicPublicId' => $clinicPublicId,
                    ]);

                    return response()->json([
                        'message' => 'Too many requests. Please retry shortly.',
                    ], 429);
                });
        });
    }
}
