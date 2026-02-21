<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class PatientAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $patient = Patient::query()
            ->select(['id', 'clinic_id', 'name', 'phone', 'portal_password'])
            ->where('phone', $validated['phone'])
            ->first();

        if (! $patient || ! $patient->portal_password || ! Hash::check($validated['password'], $patient->portal_password)) {
            return response()->json(['message' => 'Invalid patient credentials.'], 422);
        }

        $token = $patient->createToken('patient-portal', ['patient:portal'])->plainTextToken;

        return response()->json([
            'token' => $token,
            'patient' => [
                'id' => (string) $patient->id,
                'name' => $patient->name,
                'phone' => $patient->phone,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var Patient $patient */
        $patient = $request->user();

        return response()->json([
            'data' => [
                'id' => (string) $patient->id,
                'name' => $patient->name,
                'phone' => $patient->phone,
                'clinicId' => (string) $patient->clinic_id,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}
