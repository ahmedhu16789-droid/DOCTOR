<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\ClinicSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClinicController extends Controller
{
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

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'max:100'],
        ]);

        $clinic = Clinic::query()->findOrFail($id);
        $clinic->subscription_status = $validated['status'];
        $clinic->save();

        ClinicSubscription::query()
            ->where('clinic_id', $clinic->id)
            ->where('starts_at', '<=', now())
            ->where(function ($query): void {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->orderByDesc('starts_at')
            ->limit(1)
            ->update(['status' => $validated['status']]);

        return response()->json([
            'data' => $this->transformClinic($clinic->fresh('activeSubscription.plan'), true),
        ]);
    }

    private function transformClinic(Clinic $clinic, bool $includeSettings = false): array
    {
        $activeSubscription = $clinic->activeSubscription()->with('plan')->first();

        $payload = [
            'id' => (string) $clinic->id,
            'name' => $clinic->name,
            'subscriptionStatus' => $activeSubscription?->status ?? $clinic->subscription_status,
            'subscriptionType' => $activeSubscription?->subscription_type,
            'subscriptionStartsAt' => $activeSubscription?->starts_at?->toISOString(),
            'subscriptionEndsAt' => $activeSubscription?->ends_at?->toISOString(),
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
}
