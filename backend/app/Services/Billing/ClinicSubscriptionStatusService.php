<?php

namespace App\Services\Billing;

use App\Models\ClinicSubscription;
use App\Models\ClinicSubscriptionPayment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class ClinicSubscriptionStatusService
{
    public function resolve(ClinicSubscription $subscription, ?CarbonImmutable $now = null): array
    {
        $now = $now ?? CarbonImmutable::now();

        [$licenseEndAt, $hostingEndAt] = $this->calculateCoverageWindows($subscription);

        $licenseStartAt = $this->toImmutable($subscription->license_starts_at ?? $subscription->starts_at);
        $hostingStartAt = $this->toImmutable($subscription->hosting_starts_at ?? $subscription->starts_at);

        $isSuspended = $subscription->status === 'suspended';
        $licenseActive = $licenseStartAt && ($subscription->license_type === 'LIFETIME' || ($licenseEndAt && $now->betweenIncluded($licenseStartAt, $licenseEndAt)));
        $hostingActive = $hostingStartAt && $hostingEndAt && $now->betweenIncluded($hostingStartAt, $hostingEndAt);

        if ($subscription->license_type === 'ANNUAL') {
            $hostingActive = $licenseActive;
            $hostingEndAt = $licenseEndAt;
        }

        $effectiveStatus = $this->resolveStatus(
            $isSuspended,
            $subscription->license_type,
            $licenseActive,
            $hostingActive,
            $now,
            $licenseEndAt,
            $hostingEndAt
        );

        return [
            'status' => $effectiveStatus,
            'license' => [
                'type' => $subscription->license_type,
                'startsAt' => $licenseStartAt?->toIso8601String(),
                'endsAt' => $licenseEndAt?->toIso8601String(),
                'isActive' => $licenseActive,
            ],
            'hosting' => [
                'startsAt' => $hostingStartAt?->toIso8601String(),
                'endsAt' => $hostingEndAt?->toIso8601String(),
                'isActive' => $hostingActive,
            ],
        ];
    }

    /**
     * @return array{0: CarbonImmutable|null, 1: CarbonImmutable|null}
     */
    private function calculateCoverageWindows(ClinicSubscription $subscription): array
    {
        $licenseEndAt = $this->toImmutable($subscription->license_ends_at ?? $subscription->ends_at);
        $hostingEndAt = $this->toImmutable($subscription->hosting_ends_at ?? $subscription->ends_at);

        /** @var Collection<int,ClinicSubscriptionPayment> $payments */
        $payments = $subscription->payments->sortBy('paid_at')->values();

        foreach ($payments as $payment) {
            // For ANNUAL subscriptions, ANY payment kind acts as a full period extension
            if ($subscription->license_type === 'ANNUAL') {
                $base = $this->maxDate($licenseEndAt, $this->toImmutable($payment->paid_at));
                $licenseEndAt = $base?->addYears(max((int) $payment->period_years, 1));
                $hostingEndAt = $licenseEndAt;
                continue;
            }

            if ($payment->payment_kind === 'LICENSE') {
                $base = $this->maxDate($licenseEndAt, $this->toImmutable($payment->paid_at));
                $licenseEndAt = $base?->addYears(max((int) $payment->period_years, 1));
                continue;
            }

            if ($payment->payment_kind === 'HOSTING') {
                $base = $this->maxDate($hostingEndAt, $this->toImmutable($payment->paid_at));
                $hostingEndAt = $base?->addYears(max((int) $payment->period_years, 1));
            }
        }

        return [$licenseEndAt, $hostingEndAt];
    }

    private function resolveStatus(
        bool $isSuspended,
        string $licenseType,
        bool $licenseActive,
        bool $hostingActive,
        CarbonImmutable $now,
        ?CarbonImmutable $licenseEndAt,
        ?CarbonImmutable $hostingEndAt
    ): string {
        if ($isSuspended) {
            return 'suspended';
        }

        if ($licenseType === 'ANNUAL') {
            if ($licenseActive) {
                return 'active';
            }

            return $this->isWithinGrace($now, $licenseEndAt) ? 'grace' : 'expired';
        }

        if ($licenseActive && $hostingActive) {
            return 'active';
        }

        return $this->isWithinGrace($now, $hostingEndAt) ? 'grace' : 'expired';
    }

    private function isWithinGrace(CarbonImmutable $now, ?CarbonImmutable $endAt): bool
    {
        if (! $endAt) {
            return false;
        }

        $gracePeriodDays = max((int) config('billing.grace_period_days', 14), 0);

        return $gracePeriodDays > 0
            && $now->greaterThan($endAt)
            && $now->lessThanOrEqualTo($endAt->addDays($gracePeriodDays));
    }

    private function maxDate(?CarbonImmutable $current, ?CarbonImmutable $candidate): ?CarbonImmutable
    {
        if (! $current) {
            return $candidate;
        }

        if (! $candidate) {
            return $current;
        }

        return $candidate->greaterThan($current) ? $candidate : $current;
    }

    private function toImmutable(mixed $value): ?CarbonImmutable
    {
        if (! $value) {
            return null;
        }

        return CarbonImmutable::parse($value);
    }
}
