<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PatientResource;
use App\Models\Patient;
use App\Models\SensitiveAuditLog;
use App\Support\ApiCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        $phone = $request->string('phone')->value();
        $name = trim($request->string('name')->value());
        $page = max(1, $request->integer('page', 1));

        $patients = Patient::query()
                ->select(['id', 'clinic_id', 'name', 'phone', 'gender', 'age', 'medical_history_summary', 'created_at'])
                ->with(['appointments:id,patient_id,date,status', 'consents:id,patient_id,consent_type,granted,granted_at'])
                ->when(
                    $request->filled('phone'),
                    fn ($query) => $query->where('phone', 'like', '%'.$phone.'%')
                )
                ->latest('created_at')
                ->simplePaginate(50, ['*'], 'page', $page);

        if ($request->filled('phone')) {
            $normalizedInputPhone = $this->normalizePhone($phone);

            $patients->getCollection()->transform(function (Patient $patient) use ($name, $normalizedInputPhone) {
                $nameSimilarity = $this->nameSimilarity($name, $patient->name);
                $patient->setAttribute('duplicate_hint', [
                    'confidence' => $this->confidenceFromSimilarity($nameSimilarity),
                    'reason' => $this->duplicateReason($nameSimilarity),
                    'nameSimilarity' => round($nameSimilarity, 2),
                    'phoneExact' => $this->normalizePhone((string) $patient->phone) === $normalizedInputPhone,
                ]);

                return $patient;
            });
        }

        return PatientResource::collection($patients);
    }

    private function normalizePhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    private function nameSimilarity(string $inputName, string $candidateName): float
    {
        $normalizedInput = mb_strtolower(trim($inputName));
        $normalizedCandidate = mb_strtolower(trim($candidateName));

        if ($normalizedInput === '' || $normalizedCandidate === '') {
            return 0.0;
        }

        $maxLength = max(mb_strlen($normalizedInput), mb_strlen($normalizedCandidate));

        if ($maxLength === 0) {
            return 0.0;
        }

        $distance = levenshtein($normalizedInput, $normalizedCandidate);

        return max(0.0, 1 - ($distance / $maxLength));
    }

    private function confidenceFromSimilarity(float $similarity): string
    {
        if ($similarity >= 0.85) {
            return 'high';
        }

        if ($similarity >= 0.65) {
            return 'medium';
        }

        return 'low';
    }

    private function duplicateReason(float $similarity): string
    {
        if ($similarity >= 0.85) {
            return 'Name is very close to an existing patient with matching phone.';
        }

        if ($similarity >= 0.65) {
            return 'Name is somewhat similar to an existing patient with matching phone.';
        }

        return 'Phone matches but name similarity is low.';
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'gender' => ['required', 'in:Male,Female'],
            'age' => ['required', 'integer', 'min:0', 'max:120'],
            'medicalHistorySummary' => ['nullable', 'string', 'max:2000'],
            'portalPassword' => ['nullable', 'string', 'min:6', 'max:100'],
            'consents' => ['nullable', 'array'],
            'consents.treatment' => ['nullable', 'boolean'],
            'consents.privacy' => ['nullable', 'boolean'],
            'consents.communication' => ['nullable', 'boolean'],
        ]);

        $patient = Patient::create([
            'clinic_id' => $request->user()->clinic_id,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'gender' => $validated['gender'],
            'age' => $validated['age'],
            'medical_history_summary' => $validated['medicalHistorySummary'] ?? 'New Patient',
            'portal_password' => $validated['portalPassword'] ?? null,
        ]);

        $consentMap = [
            'treatment' => (bool) data_get($validated, 'consents.treatment', false),
            'privacy' => (bool) data_get($validated, 'consents.privacy', false),
            'communication' => (bool) data_get($validated, 'consents.communication', false),
        ];

        foreach ($consentMap as $type => $granted) {
            $patient->consents()->create([
                'clinic_id' => $request->user()->clinic_id,
                'consent_type' => $type,
                'granted' => $granted,
                'granted_at' => $granted ? now() : null,
            ]);
        }

        $patient->load('consents:id,patient_id,consent_type,granted,granted_at');

        ApiCache::bump('patients.index', $request->user()->clinic_id);

        return response()->json(new PatientResource($patient), 201);
    }

    public function auditTimeline(Request $request, Patient $patient): JsonResponse
    {
        abort_unless(in_array((string) $request->user()?->role, ['ADMIN', 'BRANCH_MANAGER', 'DOCTOR', 'NURSE'], true), 403);
        abort_unless((int) $patient->clinic_id === (int) $request->user()->clinic_id, 404);

        $timeline = SensitiveAuditLog::query()
            ->with('actor:id,name')
            ->where('clinic_id', $request->user()->clinic_id)
            ->where('patient_id', $patient->id)
            ->latest('created_at')
            ->limit(100)
            ->get()
            ->map(fn (SensitiveAuditLog $log) => [
                'id' => (string) $log->id,
                'actionType' => $log->action_type,
                'targetRecordType' => $log->target_record_type,
                'targetRecordId' => (string) $log->target_record_id,
                'timestamp' => optional($log->created_at)?->toIso8601String(),
                'actor' => [
                    'id' => (string) $log->actor_user_id,
                    'name' => $log->actor?->name ?? 'System',
                ],
            ])
            ->values();

        return response()->json(['data' => $timeline]);
    }
}
