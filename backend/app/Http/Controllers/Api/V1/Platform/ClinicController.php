<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClinicController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $clinics = Clinic::query()
            ->select(['id', 'name', 'subscription_status', 'created_at', 'updated_at'])
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

        return response()->json([
            'data' => $this->transformClinic($clinic, true),
        ]);
    }

    private function transformClinic(Clinic $clinic, bool $includeSettings = false): array
    {
        $payload = [
            'id' => (string) $clinic->id,
            'name' => $clinic->name,
            'subscriptionStatus' => $clinic->subscription_status,
            'createdAt' => optional($clinic->created_at)?->toISOString(),
            'updatedAt' => optional($clinic->updated_at)?->toISOString(),
        ];

        if ($includeSettings) {
            $payload['settings'] = $clinic->settings;
        }

        return $payload;
    }
}
