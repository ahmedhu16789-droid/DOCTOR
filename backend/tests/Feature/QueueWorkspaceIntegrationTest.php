<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QueueWorkspaceIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_reception_can_update_appointment_status_and_track_timestamps(): void
    {
        Carbon::setTestNow('2026-03-01 09:30:00');

        [$clinic, $doctor, $appointment] = $this->seedEncounterContext();

        Sanctum::actingAs($doctor);

        $this->patchJson("/api/v1/appointments/{$appointment->id}/status", ['status' => 'WAITING'])
            ->assertOk()
            ->assertJsonPath('data.status', 'WAITING')
            ->assertJsonPath('data.checkInAt', '2026-03-01T09:30:00+00:00')
            ->assertJsonPath('data.queueMetrics.waitingMinutes', 0);

        Carbon::setTestNow('2026-03-01 09:35:00');

        $this->patchJson("/api/v1/appointments/{$appointment->id}/status", ['status' => 'CALLED'])
            ->assertOk()
            ->assertJsonPath('data.status', 'CALLED');

        $this->patchJson("/api/v1/appointments/{$appointment->id}/status", ['status' => 'IN_PROGRESS'])
            ->assertOk()
            ->assertJsonPath('data.status', 'IN_PROGRESS');

        $this->patchJson("/api/v1/appointments/{$appointment->id}/status", ['status' => 'COMPLETED'])
            ->assertOk()
            ->assertJsonPath('data.status', 'COMPLETED');

        $appointment->refresh();

        $this->assertNotNull($appointment->check_in_at);
        $this->assertNotNull($appointment->called_at);
        $this->assertNotNull($appointment->started_at);
        $this->assertNotNull($appointment->completed_at);
        $this->assertSame('COMPLETED', $appointment->status);

        Carbon::setTestNow();
    }

    public function test_encounter_show_returns_history_and_payment_is_persisted(): void
    {
        [$clinic, $doctor, $appointment] = $this->seedEncounterContext();

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $appointment->branch_id,
            'patient_id' => $appointment->patient_id,
            'doctor_id' => $doctor->id,
            'date' => now()->subDay()->toDateString(),
            'time_slot' => '08:30',
            'status' => 'COMPLETED',
        ]);

        Sanctum::actingAs($doctor);

        $this->putJson("/api/v1/appointments/{$appointment->id}/encounter", [
            'diagnosis' => 'Hypertension',
            'plan' => 'Lifestyle changes',
            'status' => 'DRAFT',
            'prescription' => [[
                'name' => 'Amlodipine',
                'dosage' => '5mg',
            ]],
        ])->assertOk();

        $historyApt = Appointment::query()->where('id', '!=', $appointment->id)->first();
        $this->putJson("/api/v1/appointments/{$historyApt->id}/encounter", [
            'diagnosis' => 'Old visit diagnosis',
            'plan' => 'Old visit plan',
            'status' => 'FINALIZED',
            'prescription' => [],
        ])->assertOk();

        $showResponse = $this->getJson("/api/v1/appointments/{$appointment->id}/encounter");
        $showResponse
            ->assertOk()
            ->assertJsonPath('data.diagnosis', 'Hypertension')
            ->assertJsonPath('history.0.diagnosis', 'Old visit diagnosis');

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/payments", [
            'amount' => 100,
            'method' => 'CASH',
        ])->assertOk();

        $invoice = Invoice::query()->where('appointment_id', $appointment->id)->firstOrFail();
        $this->assertSame(100.0, (float) $invoice->paid_amount);
        $this->assertSame('PARTIAL', $invoice->status);
    }

    private function seedEncounterContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Integration Clinic',
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
            'name' => 'Queue Patient',
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
            'status' => 'WAITING',
        ]);

        Invoice::query()->create([
            'clinic_id' => $clinic->id,
            'appointment_id' => $appointment->id,
            'total' => 250,
            'paid_amount' => 0,
            'status' => 'UNPAID',
        ]);

        return [$clinic, $doctor, $appointment];
    }
}
