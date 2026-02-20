<?php

namespace Tests\Feature;

use App\Models\Clinic;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollPeriod;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DoctorPayrollControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_aggregates_ledger_and_returns_period_report(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-02',
            'earning_type' => 'COMMISSION',
            'basis_amount' => 1000,
            'rate' => 20,
            'amount' => 200,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-02',
            'earning_type' => 'ADJUSTMENT',
            'basis_amount' => 50,
            'rate' => null,
            'amount' => 50,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);

        Sanctum::actingAs($actor);

        $response = $this->getJson('/api/v1/reports/doctor-payroll?period_month=2026-02')->assertOk();

        $response->assertJsonPath('data.0.doctorId', $doctor->id);
        $response->assertJsonPath('data.0.totalEarned', 200.0);
        $response->assertJsonPath('data.0.totalAdjustments', 50.0);
        $response->assertJsonPath('data.0.status', 'OPEN');
    }


    public function test_adjustment_is_not_double_counted_in_total_earned(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-03',
            'earning_type' => 'COMMISSION',
            'basis_amount' => 2000,
            'rate' => 10,
            'amount' => 200,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-03',
            'earning_type' => 'ADJUSTMENT',
            'basis_amount' => 100,
            'rate' => null,
            'amount' => 100,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);

        Sanctum::actingAs($actor);

        $response = $this->getJson('/api/v1/reports/doctor-payroll?period_month=2026-03')->assertOk();

        $response->assertJsonPath('data.0.totalEarned', 200.0);
        $response->assertJsonPath('data.0.totalAdjustments', 100.0);
        $this->assertSame(300.0, (float) data_get($response->json(), 'data.0.totalEarned') + (float) data_get($response->json(), 'data.0.totalAdjustments'));
    }

    public function test_it_closes_and_settles_period(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        $period = DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-02',
            'total_earned' => 300,
            'total_adjustments' => 0,
            'total_settled' => 0,
            'status' => 'OPEN',
        ]);

        Sanctum::actingAs($actor);

        $this->postJson("/api/v1/payroll/periods/{$period->id}/close")
            ->assertOk()
            ->assertJsonPath('data.status', 'CLOSED');

        $this->postJson("/api/v1/payroll/periods/{$period->id}/settle", [
            'settlement_date' => '2026-02-28',
            'amount' => 300,
            'method' => 'bank_transfer',
            'reference' => 'TRX-1',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'SETTLED')
            ->assertJsonPath('data.totalSettled', 300.0);
    }

    public function test_closed_period_blocks_non_adjustment_ledger_entries(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-02',
            'total_earned' => 100,
            'total_adjustments' => 0,
            'total_settled' => 0,
            'status' => 'CLOSED',
            'closed_at' => now(),
        ]);

        Sanctum::actingAs($actor);

        $this->expectException(\RuntimeException::class);

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-02',
            'earning_type' => 'COMMISSION',
            'basis_amount' => 100,
            'rate' => 10,
            'amount' => 10,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);
    }

    /**
     * @return array{0: User, 1: User}
     */
    private function createUsersInSameClinic(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Test Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $actor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
            'password' => 'password123',
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'password' => 'doctor12345',
        ]);

        return [$actor, $doctor];
    }
}
