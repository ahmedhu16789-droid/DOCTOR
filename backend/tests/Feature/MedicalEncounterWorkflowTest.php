<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Medication;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MedicalEncounterWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_doctor_can_save_encounter_and_search_medications(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Clinical Flow',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main',
            'location' => 'Cairo',
            'contact_phone' => '01000000000',
            'is_active' => true,
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'password' => 'password123',
        ]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '01010000001',
            'gender' => 'Male',
            'age' => 31,
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now()->toDateString(),
            'time_slot' => '09:00',
            'status' => 'IN_PROGRESS',
        ]);

        Medication::query()->create([
            'name' => 'Panadol',
            'active_ingredient' => 'Paracetamol',
            'form' => 'Tablet',
            'strength' => '500mg',
        ]);

        Sanctum::actingAs($doctor);

        $saveResponse = $this->putJson("/api/v1/appointments/{$appointment->id}/encounter", [
            'vitals' => ['heartRate' => 80],
            'examFindings' => 'Normal chest exam',
            'diagnosis' => 'Viral URI',
            'plan' => 'Hydration and rest',
            'status' => 'DRAFT',
            'prescription' => [[
                'name' => 'Panadol',
                'activeIngredient' => 'Paracetamol',
                'dosage' => '500mg',
            ]],
        ]);

        $saveResponse
            ->assertOk()
            ->assertJsonPath('data.status', 'DRAFT')
            ->assertJsonPath('data.prescription.0.name', 'Panadol');

        $searchResponse = $this->getJson('/api/v1/medications?search=Paracetamol');

        $searchResponse
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Panadol');
    }
}
