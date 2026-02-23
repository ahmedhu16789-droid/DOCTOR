<?php

namespace App\Services\Billing;

use App\Models\Branch;
use App\Models\Clinic;
use App\Models\ClinicSubscription;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Support\Carbon;

class ClinicEntitlementService
{
    public function summary(Clinic $clinic): array
    {
        $subscription = $this->resolveActiveSubscription($clinic);
        $limits = $this->resolveLimits($subscription);
        $usage = $this->resolveUsage($clinic);

        return [
            'subscription' => [
                'id' => $subscription?->id ? (string) $subscription->id : null,
                'plan' => [
                    'id' => $subscription?->plan?->id ? (string) $subscription->plan->id : null,
                    'code' => $subscription?->plan?->code,
                    'name' => $subscription?->plan?->name,
                ],
                'type' => $subscription?->subscription_type,
                'status' => $subscription?->status,
                'startsAt' => $subscription?->starts_at?->toISOString(),
                'endsAt' => $subscription?->ends_at?->toISOString(),
            ],
            'limits' => [
                'max_branches' => $this->limitPayload($limits['max_branches'] ?? null, $usage['branches']),
                'max_doctors' => $this->limitPayload($limits['max_doctors'] ?? null, $usage['doctors']),
                'max_staff' => $this->limitPayload($limits['max_staff'] ?? null, $usage['staff']),
                'max_patients_per_month' => $this->limitPayload($limits['max_patients_per_month'] ?? null, $usage['patients_per_month']),
            ],
        ];
    }

    private function resolveActiveSubscription(Clinic $clinic): ?ClinicSubscription
    {
        $now = now();

        return ClinicSubscription::query()
            ->with(['plan', 'entitlement'])
            ->where('clinic_id', $clinic->id)
            ->where('starts_at', '<=', $now)
            ->where(function ($query) use ($now): void {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->orderByDesc('starts_at')
            ->first();
    }

    private function resolveLimits(?ClinicSubscription $subscription): array
    {
        if (! $subscription) {
            return [];
        }

        $planLimits = $subscription->plan?->default_limits ?? [];
        $entitlementLimits = [
            'max_branches' => $subscription->entitlement?->max_branches,
            'max_doctors' => $subscription->entitlement?->max_doctors,
            'max_staff' => $subscription->entitlement?->max_staff,
            'max_patients_per_month' => $subscription->entitlement?->max_patients_per_month,
        ];

        return array_merge($planLimits, array_filter($entitlementLimits, fn ($value) => $value !== null));
    }

    private function resolveUsage(Clinic $clinic): array
    {
        $startOfMonth = Carbon::now()->startOfMonth();
        $endOfMonth = Carbon::now()->endOfMonth();

        return [
            'branches' => Branch::query()->where('clinic_id', $clinic->id)->count(),
            'doctors' => User::query()->where('clinic_id', $clinic->id)->where('role', 'DOCTOR')->count(),
            'staff' => User::query()
                ->where('clinic_id', $clinic->id)
                ->whereNotIn('role', ['DOCTOR', 'ADMIN'])
                ->count(),
            'patients_per_month' => Patient::query()
                ->where('clinic_id', $clinic->id)
                ->whereBetween('created_at', [$startOfMonth, $endOfMonth])
                ->count(),
        ];
    }

    private function limitPayload(?int $limit, int $usage): array
    {
        return [
            'limit' => $limit,
            'used' => $usage,
            'remaining' => $limit !== null ? max($limit - $usage, 0) : null,
            'isUnlimited' => $limit === null,
        ];
    }
}
