<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PatientResource;
use App\Models\Patient;
use App\Support\ApiCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        $phone = $request->string('phone')->value();
        $page = max(1, $request->integer('page', 1));

        $patients = ApiCache::remember(
            'patients.index',
            $request->user()?->clinic_id,
            md5(json_encode(['phone' => $phone, 'page' => $page])),
            fn () => Patient::query()
                ->select(['id', 'clinic_id', 'name', 'phone', 'gender', 'age', 'medical_history_summary', 'created_at'])
                ->when(
                    $request->filled('phone'),
                    fn ($query) => $query->where('phone', 'like', '%'.$phone.'%')
                )
                ->latest('created_at')
                ->simplePaginate(50, ['*'], 'page', $page)
        );

        return PatientResource::collection($patients);
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

        ApiCache::bump('patients.index', $request->user()->clinic_id);

        return response()->json(new PatientResource($patient), 201);
    }
}
