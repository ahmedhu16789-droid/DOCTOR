<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DoctorProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user && $user->role === 'DOCTOR', 403);

        return response()->json([
            'examFindingTemplates' => $user->exam_finding_templates ?? [],
            'diagnosisTemplates' => $user->diagnosis_templates ?? [],
            'planTemplates' => $user->plan_templates ?? [],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user && $user->role === 'DOCTOR', 403);

        $validated = $request->validate([
            'examFindingTemplates' => ['required', 'array', 'max:30'],
            'examFindingTemplates.*' => ['string', 'min:2', 'max:180'],
            'diagnosisTemplates' => ['required', 'array', 'max:30'],
            'diagnosisTemplates.*' => ['string', 'min:2', 'max:180'],
            'planTemplates' => ['required', 'array', 'max:30'],
            'planTemplates.*' => ['string', 'min:2', 'max:180'],
        ]);

        $user->update([
            'exam_finding_templates' => $validated['examFindingTemplates'],
            'diagnosis_templates' => $validated['diagnosisTemplates'],
            'plan_templates' => $validated['planTemplates'],
        ]);

        return response()->json([
            'examFindingTemplates' => $user->exam_finding_templates ?? [],
            'diagnosisTemplates' => $user->diagnosis_templates ?? [],
            'planTemplates' => $user->plan_templates ?? [],
            'message' => 'Doctor profile updated successfully.',
        ]);
    }
}
