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
            ->with(['activeSubscription.plan'])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $clinics->map(fn (Clinic $clinic) => $this->transformClinic($clinic, true))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinic_name' => ['required', 'string', 'max:255'],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_phone' => ['required', 'string', 'max:20'],
            'admin_email' => ['nullable', 'email', 'max:255'],
            'subscription_type' => ['required', 'in:LIFETIME,ANNUAL'],
            'starts_at' => ['required', 'date'],
            'max_branches' => ['required', 'integer', 'min:1'],
            'max_doctors' => ['required', 'integer', 'min:1'],
            'max_staff' => ['nullable', 'integer', 'min:1'],
        ]);

        $result = \Illuminate\Support\Facades\DB::transaction(function () use ($validated) {
            $clinic = Clinic::query()->create([
                'name' => $validated['clinic_name'],
                'subscription_status' => 'active',
                'settings' => [],
            ]);

            $branch = \App\Models\Branch::query()->create([
                'clinic_id' => $clinic->id,
                'name' => 'الفرع الرئيسي',
                'location' => 'الفرع الرئيسي',
                'contact_phone' => $validated['admin_phone'],
                'is_active' => true,
            ]);

            $user = \App\Models\User::query()->create([
                'name' => $validated['admin_name'],
                'email' => $validated['admin_email'],
                'phone' => $validated['admin_phone'],
                'role' => 'ADMIN',
                'clinic_id' => $clinic->id,
                'password' => \Illuminate\Support\Facades\Hash::make(\Illuminate\Support\Str::random(12)),
                'is_active' => true,
            ]);

            $user->branches()->attach($branch->id, [
                'clinic_id' => $clinic->id,
            ]);

            // Find default plan
            $defaultPlanId = \Illuminate\Support\Facades\DB::table('plans')
                ->where('code', 'DEFAULT')
                ->value('id');

            // Create subscription
            $subscription = ClinicSubscription::query()->create([
                'clinic_id' => $clinic->id,
                'plan_id' => $defaultPlanId,
                'subscription_type' => $validated['subscription_type'],
                'license_type' => $validated['subscription_type'],
                'status' => 'active',
                'starts_at' => $validated['starts_at'],
                'license_starts_at' => $validated['starts_at'],
                'hosting_starts_at' => $validated['starts_at'],
            ]);

            // Create entitlement with specified limits
            $subscription->entitlement()->create([
                'clinic_id' => $clinic->id,
                'max_branches' => $validated['max_branches'],
                'max_doctors' => $validated['max_doctors'],
                'max_staff' => $validated['max_staff'] ?? 10,
                'max_patients_per_month' => 1000,
            ]);

            return [
                'clinic' => $clinic,
                'admin_user_id' => $user->id,
            ];
        });

        return response()->json([
            'message' => 'Clinic created successfully',
            'data' => [
                'clinic' => $this->transformClinic($result['clinic'], true),
                'admin_user_id' => $result['admin_user_id'],
            ],
        ], 201);
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

    public function storeSubscription(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'in:LIFETIME,ANNUAL'],
            'starts_at' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $clinic = Clinic::query()->findOrFail($id);

        // Fetch default plan to fulfill constraint
        $defaultPlanId = \Illuminate\Support\Facades\DB::table('plans')
            ->where('code', 'DEFAULT')
            ->value('id');

        $subscription = $clinic->subscriptions()->create([
            'license_type' => $validated['type'],
            'subscription_type' => $validated['type'],
            'status' => 'active',
            'starts_at' => $validated['starts_at'],
            'license_starts_at' => $validated['starts_at'],
            'hosting_starts_at' => $validated['starts_at'],
            'notes' => $validated['notes'],
            'plan_id' => $defaultPlanId, // Required constraint
        ]);

        // Automatically create default entitlements
        $subscription->entitlement()->create([
            'clinic_id' => $clinic->id,
            'max_branches' => 1,
            'max_doctors' => 3,
            'max_staff' => 10,
            'max_patients_per_month' => 500,
        ]);
        
        // Update clinic status to active if this is their first subscription
        if ($clinic->subscription_status !== 'active') {
            $clinic->update(['subscription_status' => 'active']);
        }

        return response()->json([
            'data' => $this->transformSubscriptionTimeline($subscription->fresh(['plan', 'payments.recorder'])),
        ], 201);
    }

    public function expiring(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 30);
        $threshold = now()->addDays($days);

        $clinics = Clinic::query()
            ->whereHas('subscriptions', function ($query) use ($threshold) {
                // Find subscriptions that are still active but will end soon
                $query->where(function ($q) use ($threshold) {
                    $q->whereNotNull('license_ends_at')
                      ->where('license_ends_at', '<=', $threshold)
                      ->where('license_ends_at', '>=', now()->subDays(7));
                })->orWhere(function ($q) use ($threshold) {
                    $q->whereNotNull('hosting_ends_at')
                      ->where('hosting_ends_at', '<=', $threshold)
                      ->where('hosting_ends_at', '>=', now()->subDays(7));
                });
            })
            ->with(['activeSubscription.entitlement'])
            ->get();

        return response()->json([
            'data' => $clinics->map(fn (Clinic $clinic) => $this->transformClinic($clinic))->values(),
        ]);
    }

    public function updateEntitlements(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'max_branches' => ['required', 'integer', 'min:1'],
            'max_doctors' => ['required', 'integer', 'min:1'],
        ]);

        $clinic = Clinic::query()->findOrFail($id);
        $activeSubscription = $clinic->activeSubscription;

        if (!$activeSubscription) {
            return response()->json(['message' => 'No active subscription found to attach entitlements to.'], 400);
        }

        $entitlement = $activeSubscription->entitlement()->firstOrCreate(
            ['clinic_id' => $clinic->id, 'clinic_subscription_id' => $activeSubscription->id],
            [
                'max_staff' => 25,
                'max_patients_per_month' => 1000,
            ]
        );

        $entitlement->update([
            'max_branches' => $validated['max_branches'],
            'max_doctors' => $validated['max_doctors'],
        ]);

        return response()->json([
            'data' => $this->transformClinic($clinic->fresh(['activeSubscription.entitlement', 'branches', 'users']), true),
        ]);
    }

    private function transformClinic(Clinic $clinic, bool $includeSettings = false): array
    {
        $activeSubscription = $clinic->activeSubscription()->with(['plan', 'payments', 'entitlement'])->first();
        $effective = $activeSubscription ? $this->subscriptionStatusService->resolve($activeSubscription) : null;

        // Fetch the primary admin user for this clinic
        $adminUser = $clinic->users()->where('role', 'ADMIN')->orderBy('id')->first();

        $payload = [
            'id' => (string) $clinic->id,
            'name' => $clinic->name,
            'subscriptionStatus' => $activeSubscription?->status ?? $clinic->subscription_status,
            'effectiveStatus' => $effective['status'] ?? null,
            'subscriptionType' => $activeSubscription?->license_type ?? $activeSubscription?->subscription_type,
            'subscriptionStartsAt' => $activeSubscription?->license_starts_at?->toISOString() ?? $activeSubscription?->starts_at?->toISOString(),
            'subscriptionEndsAt' => $activeSubscription?->license_ends_at?->toISOString() ?? $activeSubscription?->ends_at?->toISOString(),
            'hostingStartsAt' => $activeSubscription?->hosting_starts_at?->toISOString(),
            'hostingEndsAt' => $activeSubscription?->hosting_ends_at?->toISOString(),
            'plan' => [
                'id' => $activeSubscription?->plan?->id ? (string) $activeSubscription->plan->id : null,
                'code' => $activeSubscription?->plan?->code,
                'name' => $activeSubscription?->plan?->name,
            ],
            'entitlements' => [
                'max_branches' => $activeSubscription?->entitlement?->max_branches ?? 3,
                'current_branches' => $clinic->branches()->count(),
                'max_doctors' => $activeSubscription?->entitlement?->max_doctors ?? 10,
                'current_doctors' => $clinic->users()->where('role', 'DOCTOR')->count(),
            ],
            'adminUser' => $adminUser ? [
                'id' => (string) $adminUser->id,
                'name' => $adminUser->name,
                'email' => $adminUser->email,
                'phone' => $adminUser->phone,
            ] : null,
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
