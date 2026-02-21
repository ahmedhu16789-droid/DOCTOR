<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\MedicalEncounter;
use App\Models\Patient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PatientPortalApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_can_access_upcoming_and_visit_history_and_manage_appointment(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Portal Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Cairo',
            'contact_phone' => '01000000000',
            'is_active' => true,
        ]);

        $doctor = \App\Models\User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
        ]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Portal Patient',
            'phone' => '01012345678',
            'gender' => 'Male',
            'age' => 28,
            'portal_password' => 'secret123',
        ]);

        $upcoming = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now()->addDay()->toDateString(),
            'time_slot' => '10:00',
            'status' => 'SCHEDULED',
        ]);

        $pastAppointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now()->subDay()->toDateString(),
            'time_slot' => '09:00',
            'status' => 'COMPLETED',
        ]);

        $encounter = MedicalEncounter::query()->create([
            'clinic_id' => $clinic->id,
            'appointment_id' => $pastAppointment->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'diagnosis' => 'Common cold',
            'plan' => 'Hydration',
            'status' => 'FINALIZED',
        ]);

        $encounter->prescriptions()->create([
            'clinic_id' => $clinic->id,
            'medication_name' => 'Panadol',
            'dosage' => '500mg',
        ]);

        $loginResponse = $this->postJson('/api/v1/patient-portal/auth/login', [
            'phone' => '01012345678',
            'password' => 'secret123',
        ])->assertOk();

        $token = $loginResponse->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/patient-portal/appointments/upcoming')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $upcoming->id);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/patient-portal/appointments/'.$upcoming->id.'/reschedule', [
                'date' => now()->addDays(2)->toDateString(),
                'timeSlot' => '11:30',
            ])
            ->assertOk()
            ->assertJsonPath('data.timeSlot', '11:30');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/patient-portal/visits')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $encounter->id)
            ->assertJsonPath('data.0.prescriptions.0.medicationName', 'Panadol');

        $prescriptionId = $encounter->prescriptions()->firstOrFail()->id;

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->get('/api/v1/patient-portal/prescriptions/'.$prescriptionId.'/download')
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/patient-portal/appointments/'.$upcoming->id.'/cancel')
            ->assertOk()
            ->assertJsonPath('data.status', 'CANCELLED');
    }
}
