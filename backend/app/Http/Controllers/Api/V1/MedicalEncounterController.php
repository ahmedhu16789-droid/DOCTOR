<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\MedicalEncounter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedicalEncounterController extends Controller
{
    public function show(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorizeAppointment($request, $appointment);

        $encounter = $appointment->encounter()->with('prescriptions')->first();

        if (! $encounter) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $this->serializeEncounter($encounter)]);
    }

    public function upsert(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorizeAppointment($request, $appointment);

        $validated = $request->validate([
            'vitals' => ['nullable', 'array'],
            'examFindings' => ['nullable', 'string'],
            'diagnosis' => ['nullable', 'string'],
            'plan' => ['nullable', 'string'],
            'status' => ['nullable', 'in:DRAFT,FINALIZED'],
            'prescription' => ['nullable', 'array'],
            'prescription.*.name' => ['required_with:prescription', 'string'],
            'prescription.*.activeIngredient' => ['nullable', 'string'],
            'prescription.*.dosage' => ['nullable', 'string'],
            'prescription.*.frequency' => ['nullable', 'string'],
            'prescription.*.duration' => ['nullable', 'string'],
            'prescription.*.instructions' => ['nullable', 'string'],
        ]);

        $encounter = DB::transaction(function () use ($request, $appointment, $validated): MedicalEncounter {
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
                    'status' => $validated['status'] ?? 'DRAFT',
                    'finalized_at' => ($validated['status'] ?? null) === 'FINALIZED' ? now() : null,
                ]
            );

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

        return response()->json(['data' => $this->serializeEncounter($encounter)]);
    }

    private function authorizeAppointment(Request $request, Appointment $appointment): void
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);
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
            'status' => $encounter->status,
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
}
