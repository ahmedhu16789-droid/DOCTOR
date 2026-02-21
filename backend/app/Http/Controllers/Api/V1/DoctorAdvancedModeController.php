<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DoctorAdvancedMode\DoctorAdvancedModeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DoctorAdvancedModeController extends Controller
{
    public function __construct(private readonly DoctorAdvancedModeService $advancedModeService)
    {
    }

    public function capabilities(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user && $user->role === 'DOCTOR', 403);

        $branchId = $request->integer('branchId');

        return response()->json([
            'data' => $this->advancedModeService->capabilitiesForDoctor($user, $branchId),
        ]);
    }

    public function toggle(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user && $user->role === 'DOCTOR', 403);

        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $branchId = isset($validated['branchId']) ? (int) $validated['branchId'] : null;
        $enabled = (bool) $validated['enabled'];

        if ($branchId) {
            $updated = $user->branches()->updateExistingPivot($branchId, [
                'doctor_advanced_mode_enabled' => $enabled,
            ]);

            abort_if($updated === 0, 422, 'Doctor is not assigned to this branch.');
        } else {
            $user->update(['doctor_advanced_mode_enabled' => $enabled]);
        }

        $user->refresh();

        return response()->json([
            'data' => $this->advancedModeService->capabilitiesForDoctor($user, $branchId),
            'message' => 'Doctor Advanced Mode updated successfully.',
        ]);
    }
}
