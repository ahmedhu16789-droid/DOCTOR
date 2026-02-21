<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AppointmentDelayInsightTest extends TestCase
{
    use RefreshDatabase;

    public function test_reception_can_fetch_delay_insight_and_preview_shift(): void
    {
        Carbon::setTestNow('2026-03-10 09:25:00');

        [$doctor, $branch, $patient, $clinic, $reception] = $this->seedContext();

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '09:00',
            'status' => 'WAITING',
        ]);

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '09:30',
            'status' => 'SCHEDULED',
        ]);

        Sanctum::actingAs($reception);

        $this->getJson(sprintf('/api/v1/appointments/delay-insight?doctorId=%d&branchId=%d&date=2026-03-10', $doctor->id, $branch->id))
            ->assertOk()
            ->assertJsonPath('data.showAlert', true)
            ->assertJsonPath('data.delayMinutes', 20)
            ->assertJsonPath('data.impactedCount', 1)
            ->assertJsonPath('data.suggestedShiftMinutes', 20)
            ->assertJsonPath('data.fromTime', '09:30');

        $this->postJson('/api/v1/appointments/shift/preview', [
            'doctorId' => $doctor->id,
            'branchId' => $branch->id,
            'date' => '2026-03-10',
            'fromTime' => '09:30',
            'shiftMinutes' => 20,
        ])
            ->assertOk()
            ->assertJsonPath('data.preview.0.beforeTime', '09:30')
            ->assertJsonPath('data.preview.0.afterTime', '09:50');

        Carbon::setTestNow();
    }

    private function seedContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Delay Clinic',
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
            'schedule' => [
                ['branchId' => (string) $branch->id, 'dayOfWeek' => 2, 'startTime' => '08:00', 'endTime' => '13:00', 'slotDuration' => 20],
            ],
            'password' => 'password123',
        ]);

        $doctor->branches()->attach($branch->id, ['clinic_id' => $clinic->id]);

        $reception = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'RECEPTIONIST',
            'password' => 'password123',
        ]);

        $reception->branches()->attach($branch->id, ['clinic_id' => $clinic->id]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '01012312312',
            'gender' => 'Male',
            'age' => 30,
            'medical_history_summary' => null,
        ]);

        return [$doctor, $branch, $patient, $clinic, $reception];
    }
}
