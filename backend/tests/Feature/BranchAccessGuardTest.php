<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\DoctorEarningsLedger;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BranchAccessGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_assigned_branch_is_allowed_for_appointments_dashboard_and_payroll_filters(): void
    {
        [$clinic, $branchA] = $this->createClinicAndBranch();
        $actor = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'RECEPTIONIST']);
        $actor->branches()->attach($branchA->id, ['clinic_id' => $clinic->id]);

        $doctor = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'DOCTOR']);
        $doctor->branches()->attach($branchA->id, ['clinic_id' => $clinic->id]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Allowed Patient',
            'phone' => '01011111111',
            'gender' => 'Male',
            'age' => 30,
        ]);

        Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branchA->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now()->toDateString(),
            'time_slot' => '10:00',
            'status' => 'SCHEDULED',
        ]);

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'period_month' => now()->format('Y-m'),
            'earning_type' => 'COMMISSION',
            'basis_amount' => 100,
            'rate' => 10,
            'amount' => 10,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);

        Sanctum::actingAs($actor);

        $this->getJson("/api/v1/appointments?branchId={$branchA->id}")->assertOk();
        $this->getJson("/api/v1/reports/dashboard?branchId={$branchA->id}")->assertOk();
        $this->getJson("/api/v1/reports/doctor-payroll?branch_id={$branchA->id}")->assertOk();
        $this->getJson("/api/v1/reports/financial?branch_id={$branchA->id}")->assertOk();
    }

    public function test_unassigned_branch_is_denied_for_branch_scoped_filters(): void
    {
        [$clinic, $branchA] = $this->createClinicAndBranch('A');
        $branchB = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch B',
            'location' => 'Giza',
            'contact_phone' => '01022222222',
            'is_active' => true,
        ]);

        $actor = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'RECEPTIONIST']);
        $actor->branches()->attach($branchA->id, ['clinic_id' => $clinic->id]);

        Sanctum::actingAs($actor);

        $this->getJson("/api/v1/appointments?branchId={$branchB->id}")->assertForbidden();
        $this->getJson("/api/v1/reports/dashboard?branchId={$branchB->id}")->assertForbidden();
        $this->getJson("/api/v1/reports/doctor-payroll?branch_id={$branchB->id}")->assertForbidden();
        $this->getJson("/api/v1/reports/financial?branch_id={$branchB->id}")->assertForbidden();
    }

    public function test_admin_role_bypasses_branch_access_guard(): void
    {
        [$clinic] = $this->createClinicAndBranch();
        $branchB = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch B',
            'location' => 'Alex',
            'contact_phone' => '01033333333',
            'is_active' => true,
        ]);

        $admin = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'ADMIN']);

        Sanctum::actingAs($admin);

        $this->getJson("/api/v1/appointments?branchId={$branchB->id}")->assertOk();
        $this->getJson("/api/v1/reports/dashboard?branchId={$branchB->id}")->assertOk();
        $this->getJson("/api/v1/reports/doctor-payroll?branch_id={$branchB->id}")->assertOk();
        $this->getJson("/api/v1/reports/financial?branch_id={$branchB->id}")->assertOk();
    }


    public function test_role_privilege_matrix_blocks_doctor_from_finance_reports_even_with_branch_membership(): void
    {
        [$clinic, $branchA] = $this->createClinicAndBranch();
        $doctor = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'DOCTOR']);
        $doctor->branches()->attach($branchA->id, ['clinic_id' => $clinic->id]);

        Sanctum::actingAs($doctor);

        $this->getJson("/api/v1/reports/doctor-payroll?branch_id={$branchA->id}")->assertForbidden();
        $this->getJson("/api/v1/reports/financial?branch_id={$branchA->id}")->assertForbidden();
    }

    public function test_receptionist_can_access_cash_session_routes_for_assigned_branch(): void
    {
        [$clinic, $branchA] = $this->createClinicAndBranch();
        $actor = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'RECEPTIONIST']);
        $actor->branches()->attach($branchA->id, ['clinic_id' => $clinic->id]);

        Sanctum::actingAs($actor);

        $this->postJson('/api/v1/cash-sessions/open', [
            'branch_id' => $branchA->id,
            'opening_balance' => 100,
        ])->assertCreated();

        $this->getJson("/api/v1/reports/reconciliation?branch_id={$branchA->id}")->assertOk();
    }

    private function createClinicAndBranch(string $suffix = ''): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Guard Clinic '.$suffix,
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch '.$suffix,
            'location' => 'Cairo',
            'contact_phone' => '01000000000',
            'is_active' => true,
        ]);

        return [$clinic, $branch];
    }
}
