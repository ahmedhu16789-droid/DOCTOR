<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PatientPortalAppointmentResource;
use App\Http\Resources\Api\V1\PatientPortalEncounterResource;
use App\Http\Resources\Api\V1\PatientPortalPrescriptionResource;
use App\Models\Appointment;
use App\Models\MedicalEncounter;
use App\Models\Patient;
use App\Models\Prescription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientPortalController extends Controller
{
    public function upcomingAppointments(Request $request)
    {
        /** @var Patient $patient */
        $patient = $request->user();

        $appointments = Appointment::query()
            ->where('clinic_id', $patient->clinic_id)
            ->where('patient_id', $patient->id)
            ->whereDate('date', '>=', now()->toDateString())
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->with(['doctor:id,name,specialty', 'branch:id,name,location'])
            ->orderBy('date')
            ->orderBy('time_slot')
            ->get();

        return PatientPortalAppointmentResource::collection($appointments);
    }

    public function reschedule(Request $request, Appointment $appointment): JsonResponse
    {
        $patient = $request->user();
        $this->authorizeOwnedAppointment($patient, $appointment);

        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'timeSlot' => ['required', 'date_format:H:i'],
        ]);

        abort_if(! in_array($appointment->status, ['SCHEDULED', 'WAITING'], true), 422, 'Appointment cannot be rescheduled.');

        $appointment->update([
            'date' => $validated['date'],
            'time_slot' => $validated['timeSlot'],
        ]);

        return response()->json(['data' => new PatientPortalAppointmentResource($appointment->load(['doctor:id,name,specialty', 'branch:id,name,location']))]);
    }

    public function cancel(Request $request, Appointment $appointment): JsonResponse
    {
        $patient = $request->user();
        $this->authorizeOwnedAppointment($patient, $appointment);

        abort_if(! in_array($appointment->status, ['SCHEDULED', 'WAITING'], true), 422, 'Appointment cannot be cancelled.');

        $appointment->update(['status' => 'CANCELLED']);

        return response()->json(['data' => new PatientPortalAppointmentResource($appointment->load(['doctor:id,name,specialty', 'branch:id,name,location']))]);
    }

    public function visitHistory(Request $request)
    {
        $patient = $request->user();

        $encounters = MedicalEncounter::query()
            ->where('clinic_id', $patient->clinic_id)
            ->where('patient_id', $patient->id)
            ->with([
                'appointment:id,date,time_slot,doctor_id',
                'appointment.doctor:id,name',
                'prescriptions:id,medical_encounter_id,medication_name,active_ingredient,dosage,frequency,duration,instructions',
            ])
            ->latest('created_at')
            ->get();

        return PatientPortalEncounterResource::collection($encounters);
    }

    public function summary(Request $request, MedicalEncounter $encounter): JsonResponse
    {
        $patient = $request->user();
        $this->authorizeOwnedEncounter($patient, $encounter);

        return response()->json([
            'data' => new PatientPortalEncounterResource($encounter->load([
                'appointment:id,date,time_slot,doctor_id',
                'appointment.doctor:id,name',
                'prescriptions:id,medical_encounter_id,medication_name,active_ingredient,dosage,frequency,duration,instructions',
            ])),
        ]);
    }

    public function prescriptions(Request $request, MedicalEncounter $encounter)
    {
        $patient = $request->user();
        $this->authorizeOwnedEncounter($patient, $encounter);

        return PatientPortalPrescriptionResource::collection(
            $encounter->prescriptions()->get(['id', 'medical_encounter_id', 'medication_name', 'active_ingredient', 'dosage', 'frequency', 'duration', 'instructions'])
        );
    }

    public function downloadPrescription(Request $request, Prescription $prescription)
    {
        $patient = $request->user();

        $prescription->loadMissing('encounter:id,patient_id,clinic_id');
        abort_unless(
            (int) $prescription->encounter?->patient_id === (int) $patient->id
            && (int) $prescription->encounter?->clinic_id === (int) $patient->clinic_id,
            404
        );

        $content = implode("\n", [
            'Prescription',
            'Issued: '.Carbon::parse($prescription->created_at)->toDateString(),
            'Medication: '.$prescription->medication_name,
            'Active Ingredient: '.($prescription->active_ingredient ?: '-'),
            'Dosage: '.($prescription->dosage ?: '-'),
            'Frequency: '.($prescription->frequency ?: '-'),
            'Duration: '.($prescription->duration ?: '-'),
            'Instructions: '.($prescription->instructions ?: '-'),
        ]);

        return response($content, 200, [
            'Content-Type' => 'text/plain',
            'Content-Disposition' => 'attachment; filename="prescription-'.$prescription->id.'.txt"',
        ]);
    }

    private function authorizeOwnedAppointment(Patient $patient, Appointment $appointment): void
    {
        abort_unless(
            (int) $appointment->clinic_id === (int) $patient->clinic_id
            && (int) $appointment->patient_id === (int) $patient->id,
            404
        );
    }

    private function authorizeOwnedEncounter(Patient $patient, MedicalEncounter $encounter): void
    {
        abort_unless(
            (int) $encounter->clinic_id === (int) $patient->clinic_id
            && (int) $encounter->patient_id === (int) $patient->id,
            404
        );
    }
}
