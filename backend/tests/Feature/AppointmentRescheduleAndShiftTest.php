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

class AppointmentRescheduleAndShiftTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_shift_moves_appointments_after_given_time(): void
    {
        [$doctor, $branch, $patient, $clinic, $reception] = $this->seedContext();

        $appointmentOne = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '08:30',
            'status' => 'SCHEDULED',
        ]);

        $appointmentTwo = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        Sanctum::actingAs($reception);

        $this->postJson('/api/v1/appointments/shift', [
            'doctorId' => $doctor->id,
            'branchId' => $branch->id,
            'date' => '2026-03-10',
            'fromTime' => '09:00',
            'shiftMinutes' => 120,
        ])
            ->assertOk()
            ->assertJsonPath('data.shiftedAppointments', 1)
            ->assertJsonPath('data.shiftMinutes', 120);

        $this->assertSame('08:30', $appointmentOne->fresh()->time_slot);
        $this->assertSame('11:00', $appointmentTwo->fresh()->time_slot);
    }


    public function test_bulk_shift_updates_future_available_slots_even_if_not_booked(): void
    {
        [$doctor, $branch, $patient, $clinic, $reception] = $this->seedContext();

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        Sanctum::actingAs($reception);

        $this->postJson('/api/v1/appointments/shift', [
            'doctorId' => $doctor->id,
            'branchId' => $branch->id,
            'date' => '2026-03-10',
            'fromTime' => '08:00',
            'shiftMinutes' => 60,
        ])->assertOk();

        $availableSlotsResponse = $this->getJson(sprintf(
            '/api/v1/appointments/available-slots?doctorId=%d&branchId=%d&date=%s',
            $doctor->id,
            $branch->id,
            '2026-03-10',
        ))->assertOk();

        $times = collect($availableSlotsResponse->json('data'))->pluck('time')->all();

        $this->assertSame(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'], $times);
        $this->assertSame('10:00', Appointment::query()->first()->time_slot);
        $this->assertDatabaseHas('appointment_slot_shifts', [
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'branch_id' => $branch->id,
            'date' => '2026-03-10',
            'from_time' => '08:00',
            'shift_minutes' => 60,
        ]);
    }


    public function test_bulk_shift_is_forbidden_for_non_supported_roles(): void
    {
        [$doctor, $branch, $patient, $clinic, $reception] = $this->seedContext();

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        $nurse = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'NURSE',
            'password' => 'password123',
        ]);

        Sanctum::actingAs($nurse);

        $this->postJson('/api/v1/appointments/shift', [
            'doctorId' => $doctor->id,
            'branchId' => $branch->id,
            'date' => '2026-03-10',
            'fromTime' => '09:00',
            'shiftMinutes' => 60,
        ])->assertForbidden();
    }

    public function test_reschedule_updates_target_slot_when_available(): void
    {
        [$doctor, $branch, $patient, $clinic, $reception] = $this->seedContext();

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-12',
            'time_slot' => '09:00',
            'status' => 'WAITING',
        ]);

        Sanctum::actingAs($doctor);

        $this->postJson("/api/v1/appointments/{$appointment->id}/reschedule", [
            'date' => '2026-03-12',
            'timeSlot' => '10:00',
        ])
            ->assertOk()
            ->assertJsonPath('data.time', '10:00')
            ->assertJsonPath('data.status', 'SCHEDULED');

        $fresh = $appointment->fresh();

        $this->assertSame('10:00', $fresh->time_slot);
        $this->assertSame('SCHEDULED', $fresh->status);
    }


    public function test_bulk_shift_is_idempotent_for_same_scope(): void
    {
        [$doctor, $branch, $patient, $clinic, $reception] = $this->seedContext();

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-03-10',
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        Sanctum::actingAs($reception);

        $this->postJson('/api/v1/appointments/shift', [
            'doctorId' => $doctor->id,
            'branchId' => $branch->id,
            'date' => '2026-03-10',
            'fromTime' => '09:00',
            'shiftMinutes' => 30,
        ])->assertOk();

        $this->postJson('/api/v1/appointments/shift', [
            'doctorId' => $doctor->id,
            'branchId' => $branch->id,
            'date' => '2026-03-10',
            'fromTime' => '09:00',
            'shiftMinutes' => 30,
        ])->assertStatus(422);
    }

    private function seedContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Reschedule Clinic',
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
                ['branchId' => (string) $branch->id, 'dayOfWeek' => 2, 'startTime' => '08:00', 'endTime' => '13:00', 'slotDuration' => 30],
                ['branchId' => (string) $branch->id, 'dayOfWeek' => 4, 'startTime' => '08:00', 'endTime' => '13:00', 'slotDuration' => 30],
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
