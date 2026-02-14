<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PatientResource;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        return PatientResource::collection(
            Patient::query()
                ->select(['id', 'clinic_id', 'name', 'phone', 'gender', 'age', 'medical_history_summary', 'created_at'])
                ->when(
                    $request->filled('phone'),
                    fn ($query) => $query->where('phone', 'like', '%'.$request->string('phone')->value().'%')
                )
                ->latest('created_at')
                ->simplePaginate(50)
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'gender' => ['required', 'in:Male,Female'],
            'age' => ['required', 'integer', 'min:0', 'max:120'],
            'medicalHistorySummary' => ['nullable', 'string', 'max:2000'],
        ]);

        $patient = Patient::create([
            'clinic_id' => $request->user()->clinic_id,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'gender' => $validated['gender'],
            'age' => $validated['age'],
            'medical_history_summary' => $validated['medicalHistorySummary'] ?? 'New Patient',
        ]);

        return response()->json(new PatientResource($patient), 201);
    }
}
