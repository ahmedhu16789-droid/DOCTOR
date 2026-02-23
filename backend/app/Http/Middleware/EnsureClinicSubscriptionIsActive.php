<?php

namespace App\Http\Middleware;

use App\Models\ClinicSubscription;
use App\Services\Billing\ClinicSubscriptionStatusService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureClinicSubscriptionIsActive
{
    public function __construct(private readonly ClinicSubscriptionStatusService $subscriptionStatusService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->is_platform_admin) {
            return $next($request);
        }

        $clinic = $user->clinic;

        if (! $clinic) {
            return $this->disabledResponse('LICENSE_EXPIRED');
        }

        $subscription = ClinicSubscription::query()
            ->with('payments')
            ->where('clinic_id', $clinic->id)
            ->where('license_starts_at', '<=', now())
            ->orderByDesc('license_starts_at')
            ->first();

        if (! $subscription) {
            return $this->disabledResponse('LICENSE_EXPIRED');
        }

        $status = $this->subscriptionStatusService->resolve($subscription);

        if ($status['status'] === 'active' || $status['status'] === 'grace') {
            return $next($request);
        }

        if ($status['status'] === 'suspended') {
            return $this->disabledResponse('SUSPENDED');
        }

        if (! ($status['license']['isActive'] ?? false)) {
            return $this->disabledResponse('LICENSE_EXPIRED');
        }

        return $this->disabledResponse('HOSTING_EXPIRED');
    }

    private function disabledResponse(string $reason): JsonResponse
    {
        return response()->json([
            'message' => 'Clinic subscription is not active.',
            'reason' => $reason,
        ], 402);
    }
}
