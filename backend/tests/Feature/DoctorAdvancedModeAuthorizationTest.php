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

class DoctorAdvancedModeAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_doctor_can_toggle_advanced_mode_and_read_capabilities(): void
    {
        [$doctor] = $this->seedContext();

        Sanctum::actingAs($doctor);

        $this->getJson('/api/v1/doctor/advanced-mode/capabilities')
            ->assertOk()
            ->assertJsonPath('data.advancedModeEnabled', false)
            ->assertJsonPath('data.canRescheduleOwnSameDayAppointments', false);

        $this->putJson('/api/v1/doctor/advanced-mode', [
            'enabled' => true,
        ])->assertOk()
            ->assertJsonPath('data.advancedModeEnabled', true)
            ->assertJsonPath('data.canViewDayTimelineAndDelays', true);

        $this->assertDatabaseHas('users', [
            'id' => $doctor->id,
            'doctor_advanced_mode_enabled' => true,
        ]);
    }

    public function test_doctor_cannot_reschedule_or_cancel_without_advanced_mode(): void
    {
        Carbon::setTestNow('2026-03-01 09:30:00');

        [$doctor, $appointment] = $this->seedContext();

        Sanctum::actingAs($doctor);

        $this->postJson("/api/v1/appointments/{$appointment->id}/reschedule", [
            'date' => '2026-03-01',
            'timeSlot' => '10:00',
        ])->assertForbidden();

        $this->patchJson("/api/v1/appointments/{$appointment->id}/status", [
            'status' => 'CANCELLED',
        ])->assertForbidden();

        Carbon::setTestNow();
    }

    public function test_doctor_with_advanced_mode_can_only_manage_own_same_day_same_branch_appointment(): void
    {
        Carbon::setTestNow('2026-03-01 09:30:00');

        [$doctor, $appointment, $otherBranchAppointment, $tomorrowAppointment] = $this->seedContext(includeExtraAppointments: true);

        $doctor->update(['doctor_advanced_mode_enabled' => true]);

        Sanctum::actingAs($doctor);

        $this->postJson("/api/v1/appointments/{$appointment->id}/reschedule", [
            'date' => '2026-03-01',
            'timeSlot' => '10:00',
        ])->assertOk();

        $this->patchJson("/api/v1/appointments/{$appointment->id}/status", [
            'status' => 'CANCELLED',
        ])->assertOk();

        $this->postJson("/api/v1/appointments/{$otherBranchAppointment->id}/reschedule", [
            'date' => '2026-03-01',
            'timeSlot' => '10:30',
        ])->assertForbidden();

        $this->postJson("/api/v1/appointments/{$tomorrowAppointment->id}/reschedule", [
            'date' => '2026-03-02',
            'timeSlot' => '11:00',
        ])->assertForbidden();

        Carbon::setTestNow();
    }

    private function seedContext(bool $includeExtraAppointments = false): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Advanced Mode Clinic',
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

        $secondBranch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Secondary',
            'location' => 'Giza',
            'contact_phone' => '01000000001',
            'is_active' => true,
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'doctor_advanced_mode_enabled' => false,
            'schedule' => [
                [
                    'dayOfWeek' => 0,
                    'branchId' => (string) $branch->id,
                    'startTime' => '09:00',
                    'endTime' => '17:00',
                    'slotDuration' => 30,
                ],
            ],
        ]);

        $doctor->branches()->attach([$branch->id, $secondBranch->id], ['clinic_id' => $clinic->id]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '01010000001',
            'gender' => 'Male',
            'age' => 40,
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-01',
            'time_slot' => '09:30',
            'status' => 'SCHEDULED',
        ]);

        if (! $includeExtraAppointments) {
            return [$doctor, $appointment];
        }

        $otherBranchAppointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $secondBranch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-01',
            'time_slot' => '10:30',
            'status' => 'SCHEDULED',
        ]);

        $tomorrowAppointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-02',
            'time_slot' => '11:00',
            'status' => 'SCHEDULED',
        ]);

        return [$doctor, $appointment, $otherBranchAppointment, $tomorrowAppointment];
    }
}
