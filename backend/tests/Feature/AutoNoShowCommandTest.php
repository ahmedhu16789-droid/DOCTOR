<?php

namespace Tests\Feature;

use App\Jobs\ProcessClinicNoShowJob;
use App\Models\Appointment;
use App\Models\AppointmentNoShowRule;
use App\Models\AppointmentStatusAudit;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use App\Services\Appointments\NoShowAutomationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AutoNoShowCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_dispatch_command_queues_one_job_per_clinic(): void
    {
        Queue::fake();

        Clinic::query()->create(['name' => 'A', 'subscription_status' => 'trial', 'settings' => ['timezone' => 'UTC']]);
        Clinic::query()->create(['name' => 'B', 'subscription_status' => 'trial', 'settings' => ['timezone' => 'UTC']]);

        Artisan::call('appointments:no-show:dispatch', ['--mode' => 'time']);

        Queue::assertPushed(ProcessClinicNoShowJob::class, 2);
    }

    public function test_time_mode_marks_scheduled_appointment_as_no_show_and_writes_audit(): void
    {
        [$appointment] = $this->seedAppointment(status: 'SCHEDULED', timeSlot: now('UTC')->subMinutes(50)->format('H:i'));

        app(NoShowAutomationService::class)->processClinic($appointment->clinic_id, 'time');

        $appointment->refresh();

        $this->assertSame('NO_SHOW', $appointment->status);
        $this->assertNotNull($appointment->no_show_at);

        $this->assertDatabaseHas('appointment_status_audits', [
            'appointment_id' => $appointment->id,
            'to_status' => 'NO_SHOW',
            'actor_type' => 'SYSTEM',
            'reason' => 'GRACE_PERIOD_EXCEEDED',
        ]);
    }

    public function test_waiting_is_not_marked_without_include_waiting_rule(): void
    {
        [$appointment] = $this->seedAppointment(status: 'WAITING', timeSlot: now('UTC')->subMinutes(90)->format('H:i'));

        app(NoShowAutomationService::class)->processClinic($appointment->clinic_id, 'time');

        $appointment->refresh();

        $this->assertSame('WAITING', $appointment->status);
        $this->assertNull($appointment->no_show_at);
        $this->assertDatabaseCount('appointment_status_audits', 0);
    }

    public function test_eod_mode_marks_only_target_clinic_and_never_touches_in_progress(): void
    {
        [$eligibleAppointment, $branch, $doctor] = $this->seedAppointment(status: 'SCHEDULED', timeSlot: '09:00');

        AppointmentNoShowRule::query()->create([
            'clinic_id' => $eligibleAppointment->clinic_id,
            'branch_id' => $branch->id,
            'specialty' => $doctor->specialty,
            'grace_minutes' => 15,
            'include_waiting' => true,
            'end_of_day_cutoff_time' => now('UTC')->subHour()->format('H:i:s'),
            'is_active' => true,
        ]);

        $inProgress = Appointment::query()->create([
            'clinic_id' => $eligibleAppointment->clinic_id,
            'branch_id' => $branch->id,
            'patient_id' => $eligibleAppointment->patient_id,
            'doctor_id' => $doctor->id,
            'date' => now('UTC')->toDateString(),
            'time_slot' => '10:00',
            'status' => 'IN_PROGRESS',
            'started_at' => now('UTC')->subMinutes(10),
        ]);

        $otherClinic = Clinic::query()->create(['name' => 'Other', 'subscription_status' => 'trial', 'settings' => ['timezone' => 'UTC']]);
        $otherBranch = Branch::query()->create([
            'clinic_id' => $otherClinic->id,
            'name' => 'Other Branch',
            'location' => 'Alex',
            'contact_phone' => '01100000000',
            'is_active' => true,
        ]);
        $otherPatient = Patient::query()->create([
            'clinic_id' => $otherClinic->id,
            'name' => 'Other Patient',
            'phone' => '01120000000',
            'gender' => 'Male',
            'age' => 25,
            'medical_history_summary' => null,
        ]);
        $otherDoctor = User::factory()->create(['clinic_id' => $otherClinic->id, 'role' => 'DOCTOR', 'specialty' => 'Dermatology']);
        $otherAppointment = Appointment::query()->create([
            'clinic_id' => $otherClinic->id,
            'branch_id' => $otherBranch->id,
            'patient_id' => $otherPatient->id,
            'doctor_id' => $otherDoctor->id,
            'date' => now('UTC')->toDateString(),
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        app(NoShowAutomationService::class)->processClinic($eligibleAppointment->clinic_id, 'eod');

        $eligibleAppointment->refresh();
        $inProgress->refresh();
        $otherAppointment->refresh();

        $this->assertSame('NO_SHOW', $eligibleAppointment->status);
        $this->assertSame('IN_PROGRESS', $inProgress->status);
        $this->assertSame('SCHEDULED', $otherAppointment->status);

        $this->assertGreaterThanOrEqual(1, AppointmentStatusAudit::query()->count());
    }

    /**
     * @return array{Appointment, Branch, User}
     */
    private function seedAppointment(string $status, string $timeSlot): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Auto No Show Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Cairo',
            'contact_phone' => '01000000000',
            'is_active' => true,
        ]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient',
            'phone' => '01050000000',
            'gender' => 'Male',
            'age' => 40,
            'medical_history_summary' => null,
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'specialty' => 'Cardiology',
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now('UTC')->toDateString(),
            'time_slot' => $timeSlot,
            'status' => $status,
        ]);

        return [$appointment, $branch, $doctor];
    }
}
