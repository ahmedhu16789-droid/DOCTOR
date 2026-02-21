<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\SensitiveAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PatientConsentAndAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_patient_creation_persists_consents(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Consent Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $admin = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/patients', [
            'name' => 'Consent Test Patient',
            'phone' => '01044444444',
            'gender' => 'Female',
            'age' => 22,
            'consents' => [
                'treatment' => true,
                'privacy' => true,
                'communication' => false,
            ],
        ])->assertCreated()
            ->assertJsonPath('consents.treatment', true)
            ->assertJsonPath('consents.privacy', true)
            ->assertJsonPath('consents.communication', false);

        $this->assertDatabaseHas('patient_consents', [
            'consent_type' => 'treatment',
            'granted' => true,
        ]);
    }

    public function test_encounter_actions_write_sensitive_audits_and_are_visible_in_timeline(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Audit Clinic',
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

        Sanctum::actingAs($doctor);

        $this->getJson("/api/v1/appointments/{$appointment->id}/encounter")->assertOk();

        $this->putJson("/api/v1/appointments/{$appointment->id}/encounter", [
            'diagnosis' => 'Flu',
            'status' => 'DRAFT',
            'prescription' => [[
                'name' => 'Panadol',
                'dosage' => '500mg',
            ]],
        ])->assertOk();

        $this->assertDatabaseHas('sensitive_audit_logs', [
            'patient_id' => $patient->id,
            'action_type' => 'PATIENT_RECORD_VIEWED',
        ]);

        $this->assertDatabaseHas('sensitive_audit_logs', [
            'patient_id' => $patient->id,
            'action_type' => 'ENCOUNTER_UPDATED',
        ]);

        $this->assertDatabaseHas('sensitive_audit_logs', [
            'patient_id' => $patient->id,
            'action_type' => 'PRESCRIPTION_CHANGED',
        ]);

        $timelineResponse = $this->getJson("/api/v1/patients/{$patient->id}/audit-timeline");
        $timelineResponse->assertOk()->assertJsonPath('data.0.actor.name', $doctor->name);

        $this->assertGreaterThanOrEqual(3, SensitiveAuditLog::query()->where('patient_id', $patient->id)->count());
    }
}
