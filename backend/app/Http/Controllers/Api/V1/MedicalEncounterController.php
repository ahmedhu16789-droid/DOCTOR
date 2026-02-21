<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\MedicalEncounter;
use App\Models\SensitiveAuditLog;
use Illuminate\Http\JsonResponse;
use App\Support\Authorization\ClinicBranchAuthorization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedicalEncounterController extends Controller
{
    public function __construct(private readonly ClinicBranchAuthorization $authorization)
    {
    }
    public function show(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorizeAppointment($request, $appointment);

        $encounter = $appointment->encounter()->with('prescriptions')->first();

        $history = MedicalEncounter::query()
            ->where('patient_id', $appointment->patient_id)
            ->where('id', '!=', $encounter?->id)
            ->with(['appointment:id,date,time_slot', 'prescriptions'])
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(fn (MedicalEncounter $item) => $this->serializeEncounter($item))
            ->values();

        if (! $encounter) {
            $this->logSensitiveAction($request, $appointment, 'PATIENT_RECORD_VIEWED', 'patient', (int) $appointment->patient_id);

            return response()->json([
                'data' => null,
                'history' => $history,
            ]);
        }

        $this->logSensitiveAction($request, $appointment, 'PATIENT_RECORD_VIEWED', 'patient', (int) $appointment->patient_id);

        return response()->json([
            'data' => $this->serializeEncounter($encounter),
            'history' => $history,
        ]);
    }

    public function upsert(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorizeAppointment($request, $appointment);

        $validated = $request->validate([
            'vitals' => ['nullable', 'array'],
            'examFindings' => ['nullable', 'string'],
            'diagnosis' => ['nullable', 'string'],
            'plan' => ['nullable', 'string'],
            'nextVisitDate' => ['nullable', 'date'],
            'nextVisitType' => ['nullable', 'string'],
            'nextVisitInterval' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:DRAFT,FINALIZED'],
            'prescription' => ['nullable', 'array'],
            'prescription.*.name' => ['required_with:prescription', 'string'],
            'prescription.*.activeIngredient' => ['nullable', 'string'],
            'prescription.*.dosage' => ['nullable', 'string'],
            'prescription.*.frequency' => ['nullable', 'string'],
            'prescription.*.duration' => ['nullable', 'string'],
            'prescription.*.instructions' => ['nullable', 'string'],
        ]);

        $prescriptionWasChanged = false;

        $encounter = DB::transaction(function () use ($request, $appointment, $validated, &$prescriptionWasChanged): MedicalEncounter {
            $encounter = MedicalEncounter::query()->updateOrCreate(
                ['appointment_id' => $appointment->id],
                [
                    'clinic_id' => $request->user()->clinic_id,
                    'patient_id' => $appointment->patient_id,
                    'doctor_id' => $appointment->doctor_id,
                    'vitals' => $validated['vitals'] ?? null,
                    'exam_findings' => $validated['examFindings'] ?? null,
                    'diagnosis' => $validated['diagnosis'] ?? null,
                    'plan' => $validated['plan'] ?? null,
                    'next_visit_date' => $validated['nextVisitDate'] ?? null,
                    'next_visit_type' => $validated['nextVisitType'] ?? null,
                    'next_visit_interval' => $validated['nextVisitInterval'] ?? null,
                    'status' => $validated['status'] ?? 'DRAFT',
                    'finalized_at' => ($validated['status'] ?? null) === 'FINALIZED' ? now() : null,
                ]
            );

            $existingPrescription = $encounter->prescriptions()
                ->get(['medication_name', 'active_ingredient', 'dosage', 'frequency', 'duration', 'instructions'])
                ->map(fn ($item) => [
                    'name' => (string) $item->medication_name,
                    'activeIngredient' => (string) ($item->active_ingredient ?? ''),
                    'dosage' => (string) ($item->dosage ?? ''),
                    'frequency' => (string) ($item->frequency ?? ''),
                    'duration' => (string) ($item->duration ?? ''),
                    'instructions' => (string) ($item->instructions ?? ''),
                ])
                ->values()
                ->all();

            $incomingPrescription = collect($validated['prescription'] ?? [])
                ->map(fn ($item) => [
                    'name' => (string) ($item['name'] ?? ''),
                    'activeIngredient' => (string) ($item['activeIngredient'] ?? ''),
                    'dosage' => (string) ($item['dosage'] ?? ''),
                    'frequency' => (string) ($item['frequency'] ?? ''),
                    'duration' => (string) ($item['duration'] ?? ''),
                    'instructions' => (string) ($item['instructions'] ?? ''),
                ])
                ->values()
                ->all();

            $prescriptionWasChanged = $existingPrescription !== $incomingPrescription;

            $encounter->prescriptions()->delete();

            foreach ($validated['prescription'] ?? [] as $medication) {
                $encounter->prescriptions()->create([
                    'clinic_id' => $request->user()->clinic_id,
                    'medication_name' => $medication['name'],
                    'active_ingredient' => $medication['activeIngredient'] ?? null,
                    'dosage' => $medication['dosage'] ?? null,
                    'frequency' => $medication['frequency'] ?? null,
                    'duration' => $medication['duration'] ?? null,
                    'instructions' => $medication['instructions'] ?? null,
                ]);
            }

            return $encounter->load('prescriptions');
        });

        $this->logSensitiveAction($request, $appointment, 'ENCOUNTER_UPDATED', 'medical_encounter', (int) $encounter->id);
        if ($prescriptionWasChanged) {
            $this->logSensitiveAction($request, $appointment, 'PRESCRIPTION_CHANGED', 'medical_encounter', (int) $encounter->id);
        }

        return response()->json(['data' => $this->serializeEncounter($encounter)]);
    }

    private function authorizeAppointment(Request $request, Appointment $appointment): void
    {
        $this->authorization->assertTenantOwnership($request->user(), $appointment);
    }

    private function serializeEncounter(MedicalEncounter $encounter): array
    {
        return [
            'id' => (string) $encounter->id,
            'appointmentId' => (string) $encounter->appointment_id,
            'vitals' => $encounter->vitals,
            'examFindings' => $encounter->exam_findings,
            'diagnosis' => $encounter->diagnosis,
            'plan' => $encounter->plan,
            'nextVisitDate' => optional($encounter->next_visit_date)?->format('Y-m-d'),
            'nextVisitType' => $encounter->next_visit_type,
            'nextVisitInterval' => $encounter->next_visit_interval,
            'status' => $encounter->status,
            'date' => $encounter->appointment?->date?->toDateString(),
            'timeSlot' => $encounter->appointment?->time_slot,
            'prescription' => $encounter->prescriptions->map(fn ($medication) => [
                'id' => (string) $medication->id,
                'name' => $medication->medication_name,
                'activeIngredient' => $medication->active_ingredient,
                'dosage' => $medication->dosage,
                'frequency' => $medication->frequency,
                'duration' => $medication->duration,
                'instructions' => $medication->instructions,
            ])->values()->all(),
        ];
    }

    private function logSensitiveAction(Request $request, Appointment $appointment, string $actionType, string $targetRecordType, int $targetRecordId): void
    {
        SensitiveAuditLog::query()->create([
            'clinic_id' => $request->user()->clinic_id,
            'patient_id' => $appointment->patient_id,
            'actor_user_id' => $request->user()->id,
            'action_type' => $actionType,
            'target_record_type' => $targetRecordType,
            'target_record_id' => $targetRecordId,
        ]);
    }
}
