<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClinicScopedReferenceValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_appointment_request_rejects_cross_clinic_patient_doctor_and_branch_ids(): void
    {
        [$clinicA, $branchA] = $this->createClinicWithBranch('A');
        [$clinicB, $branchB] = $this->createClinicWithBranch('B');

        $actor = User::factory()->create(['clinic_id' => $clinicA->id, 'role' => 'ADMIN']);

        $doctorA = User::factory()->create([
            'clinic_id' => $clinicA->id,
            'role' => 'DOCTOR',
            'schedule' => [
                ['branchId' => (string) $branchA->id, 'dayOfWeek' => 1, 'startTime' => '09:00', 'endTime' => '12:00', 'slotDuration' => 30],
            ],
        ]);
        $doctorA->branches()->attach($branchA->id, ['clinic_id' => $clinicA->id]);

        $patientA = Patient::query()->create([
            'clinic_id' => $clinicA->id,
            'name' => 'Patient A',
            'phone' => '01000000011',
            'gender' => 'Male',
            'age' => 29,
        ]);

        $doctorB = User::factory()->create(['clinic_id' => $clinicB->id, 'role' => 'DOCTOR']);
        $patientB = Patient::query()->create([
            'clinic_id' => $clinicB->id,
            'name' => 'Patient B',
            'phone' => '01000000022',
            'gender' => 'Female',
            'age' => 31,
        ]);

        Sanctum::actingAs($actor);

        $payload = [
            'patientId' => $patientB->id,
            'doctorId' => $doctorB->id,
            'branchId' => $branchB->id,
            'date' => now()->next('Monday')->toDateString(),
            'timeSlot' => '09:00',
            'billing' => [
                'total' => 100,
                'paidAmount' => 0,
                'status' => 'UNPAID',
            ],
        ];

        $this->postJson('/api/v1/appointments', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['patientId', 'doctorId', 'branchId']);

        // sanity check for same-clinic references still valid
        $payload['patientId'] = $patientA->id;
        $payload['doctorId'] = $doctorA->id;
        $payload['branchId'] = $branchA->id;

        $this->postJson('/api/v1/appointments', $payload)->assertCreated();
    }

    public function test_doctor_upsert_rejects_cross_clinic_assigned_branches_and_schedule_branch_ids(): void
    {
        [$clinicA, $branchA] = $this->createClinicWithBranch('A');
        [, $branchB] = $this->createClinicWithBranch('B');

        $actor = User::factory()->create(['clinic_id' => $clinicA->id, 'role' => 'ADMIN']);

        Sanctum::actingAs($actor);

        $payload = $this->doctorPayload($branchA->id, $branchB->id);

        $this->postJson('/api/v1/doctors', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assignedBranches.1', 'schedule.0.branchId']);
    }

    public function test_employee_upsert_rejects_cross_clinic_assigned_branches_and_schedule_branch_ids(): void
    {
        [$clinicA, $branchA] = $this->createClinicWithBranch('A');
        [, $branchB] = $this->createClinicWithBranch('B');

        $actor = User::factory()->create(['clinic_id' => $clinicA->id, 'role' => 'ADMIN']);

        Sanctum::actingAs($actor);

        $payload = [
            'name' => 'Employee One',
            'phone' => '01044444444',
            'email' => 'employee@example.com',
            'jobTitle' => 'Reception',
            'role' => 'RECEPTIONIST',
            'assignedBranches' => [$branchA->id, $branchB->id],
            'payroll' => [
                'model' => 'FIXED_SALARY',
                'baseSalary' => 5000,
                'commissionPercentage' => null,
            ],
            'schedule' => [
                [
                    'dayOfWeek' => 1,
                    'startTime' => '09:00',
                    'endTime' => '15:00',
                    'slotDuration' => 30,
                    'branchId' => $branchB->id,
                ],
            ],
        ];

        $this->postJson('/api/v1/employees', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assignedBranches.1', 'schedule.0.branchId']);
    }

    private function createClinicWithBranch(string $suffix): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Clinic '.$suffix,
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch '.$suffix,
            'location' => 'Cairo',
            'contact_phone' => '01012345678',
            'is_active' => true,
        ]);

        return [$clinic, $branch];
    }

    private function doctorPayload(int $allowedBranchId, int $forbiddenBranchId): array
    {
        return [
            'name' => 'Doctor One',
            'phone' => '01033333333',
            'email' => 'doctor@example.com',
            'specialty' => 'Cardiology',
            'consultationFee' => 250,
            'assignedBranches' => [$allowedBranchId, $forbiddenBranchId],
            'payroll' => [
                'model' => 'PERCENTAGE',
                'baseSalary' => 0,
                'commissionPercentage' => 20,
                'additionalServicesCommissionEnabled' => false,
                'additionalServicesCommissionPercentage' => null,
            ],
            'schedule' => [
                [
                    'dayOfWeek' => 1,
                    'startTime' => '09:00',
                    'endTime' => '15:00',
                    'slotDuration' => 30,
                    'branchId' => $forbiddenBranchId,
                ],
            ],
        ];
    }
}
