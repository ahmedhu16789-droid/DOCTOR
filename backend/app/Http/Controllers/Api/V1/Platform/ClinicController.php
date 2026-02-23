<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\ClinicSubscription;
use App\Models\ClinicSubscriptionPayment;
use App\Services\Billing\ClinicSubscriptionStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClinicController extends Controller
{
    public function __construct(private readonly ClinicSubscriptionStatusService $subscriptionStatusService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $clinics = Clinic::query()
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $clinics->map(fn (Clinic $clinic) => $this->transformClinic($clinic))->values(),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $clinic = Clinic::query()->findOrFail($id);

        return response()->json([
            'data' => $this->transformClinic($clinic, true),
        ]);
    }

    public function timeline(int $id): JsonResponse
    {
        $clinic = Clinic::query()->findOrFail($id);

        $subscriptions = ClinicSubscription::query()
            ->with(['plan', 'payments.recorder'])
            ->where('clinic_id', $clinic->id)
            ->orderByDesc('license_starts_at')
            ->get();

        return response()->json([
            'data' => [
                'clinicId' => (string) $clinic->id,
                'subscriptions' => $subscriptions->map(fn (ClinicSubscription $subscription) => $this->transformSubscriptionTimeline($subscription))->values(),
            ],
        ]);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:active,grace,suspended,expired'],
        ]);

        $clinic = Clinic::query()->findOrFail($id);
        $clinic->subscription_status = $validated['status'];
        $clinic->save();

        ClinicSubscription::query()
            ->where('clinic_id', $clinic->id)
            ->where('license_starts_at', '<=', now())
            ->orderByDesc('license_starts_at')
            ->limit(1)
            ->update(['status' => $validated['status']]);

        return response()->json([
            'data' => $this->transformClinic($clinic->fresh('activeSubscription.plan'), true),
        ]);
    }

    public function storePayment(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'clinic_subscription_id' => ['required', 'integer'],
            'payment_kind' => ['required', 'in:LICENSE,HOSTING'],
            'period_years' => ['required', 'integer', 'min:1', 'max:10'],
            'amount' => ['required', 'numeric', 'min:0'],
            'paid_at' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
            'receipt_ref' => ['nullable', 'string', 'max:255'],
        ]);

        $clinic = Clinic::query()->findOrFail($id);

        $subscription = ClinicSubscription::query()
            ->where('clinic_id', $clinic->id)
            ->findOrFail($validated['clinic_subscription_id']);

        $payment = ClinicSubscriptionPayment::query()->create([
            ...$validated,
            'recorded_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => [
                'id' => (string) $payment->id,
                'subscription' => $this->transformSubscriptionTimeline($subscription->fresh(['plan', 'payments.recorder'])),
            ],
        ], 201);
    }

    private function transformClinic(Clinic $clinic, bool $includeSettings = false): array
    {
        $activeSubscription = $clinic->activeSubscription()->with(['plan', 'payments'])->first();
        $effective = $activeSubscription ? $this->subscriptionStatusService->resolve($activeSubscription) : null;

        $payload = [
            'id' => (string) $clinic->id,
            'name' => $clinic->name,
            'subscriptionStatus' => $activeSubscription?->status ?? $clinic->subscription_status,
            'effectiveStatus' => $effective['status'] ?? null,
            'subscriptionType' => $activeSubscription?->license_type,
            'subscriptionStartsAt' => $activeSubscription?->license_starts_at?->toISOString(),
            'subscriptionEndsAt' => $activeSubscription?->license_ends_at?->toISOString(),
            'hostingStartsAt' => $activeSubscription?->hosting_starts_at?->toISOString(),
            'hostingEndsAt' => $activeSubscription?->hosting_ends_at?->toISOString(),
            'plan' => [
                'id' => $activeSubscription?->plan?->id ? (string) $activeSubscription->plan->id : null,
                'code' => $activeSubscription?->plan?->code,
                'name' => $activeSubscription?->plan?->name,
            ],
            'createdAt' => optional($clinic->created_at)?->toISOString(),
            'updatedAt' => optional($clinic->updated_at)?->toISOString(),
        ];

        if ($includeSettings) {
            $payload['settings'] = $clinic->settings;
        }

        return $payload;
    }

    private function transformSubscriptionTimeline(ClinicSubscription $subscription): array
    {
        $effective = $this->subscriptionStatusService->resolve($subscription);

        return [
            'id' => (string) $subscription->id,
            'plan' => [
                'id' => $subscription->plan?->id ? (string) $subscription->plan->id : null,
                'code' => $subscription->plan?->code,
                'name' => $subscription->plan?->name,
            ],
            'status' => $subscription->status,
            'effectiveStatus' => $effective['status'],
            'license' => $effective['license'],
            'hosting' => $effective['hosting'],
            'payments' => $subscription->payments
                ->sortByDesc('paid_at')
                ->values()
                ->map(fn (ClinicSubscriptionPayment $payment) => [
                    'id' => (string) $payment->id,
                    'paymentKind' => $payment->payment_kind,
                    'periodYears' => $payment->period_years,
                    'amount' => (float) $payment->amount,
                    'paidAt' => $payment->paid_at?->toISOString(),
                    'recordedBy' => $payment->recorder ? [
                        'id' => (string) $payment->recorder->id,
                        'name' => $payment->recorder->name,
                    ] : null,
                    'notes' => $payment->notes,
                    'receiptRef' => $payment->receipt_ref,
                ]),
        ];
    }
}
