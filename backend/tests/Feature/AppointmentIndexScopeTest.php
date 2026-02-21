<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AppointmentIndexScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_doctor_only_sees_his_own_appointments_even_when_doctor_filter_targets_other_doctor(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Scope Test Clinic',
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

        $doctorOne = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'password' => 'password123',
        ]);

        $doctorTwo = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'password' => 'password123',
        ]);

        $patientOne = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '01010000001',
            'gender' => 'Male',
            'age' => 31,
            'medical_history_summary' => null,
        ]);

        $patientTwo = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient Two',
            'phone' => '01010000002',
            'gender' => 'Female',
            'age' => 29,
            'medical_history_summary' => null,
        ]);

        $doctorOneAppointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patientOne->id,
            'doctor_id' => $doctorOne->id,
            'date' => '2026-03-01',
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        $doctorTwoAppointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patientTwo->id,
            'doctor_id' => $doctorTwo->id,
            'date' => '2026-03-01',
            'time_slot' => '10:00',
            'status' => 'SCHEDULED',
        ]);

        Sanctum::actingAs($doctorOne);

        $response = $this->getJson("/api/v1/appointments?doctorId={$doctorTwo->id}");

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', (string) $doctorOneAppointment->id)
            ->assertJsonPath('data.0.checkInAt', null)
            ->assertJsonPath('data.0.calledAt', null)
            ->assertJsonPath('data.0.startedAt', null)
            ->assertJsonPath('data.0.completedAt', null)
            ->assertJsonPath('data.0.noShowAt', null)
            ->assertJsonPath('data.0.queueMetrics.serviceMinutes', null)
            ->assertJsonMissingPath('data.1.id');

        $this->assertNotSame((string) $doctorTwoAppointment->id, data_get($response->json(), 'data.0.id'));
    }
}
