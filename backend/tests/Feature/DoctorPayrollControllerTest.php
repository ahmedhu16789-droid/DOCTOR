<?php

namespace Tests\Feature;

use App\Models\Clinic;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollPeriod;
use App\Models\DoctorPayrollSettlement;
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


    public function test_report_returns_commission_breakdown_when_services_commission_enabled(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-04',
            'earning_type' => 'COMMISSION',
            'basis_amount' => 1000,
            'rate' => null,
            'amount' => 170,
            'currency' => 'EGP',
            'status' => 'PENDING',
            'notes' => json_encode([
                'consultation_basis' => 700,
                'consultation_rate' => 20,
                'services_basis' => 300,
                'services_rate' => 10,
            ]),
        ]);

        Sanctum::actingAs($actor);

        $response = $this->getJson('/api/v1/reports/doctor-payroll?period_month=2026-04')->assertOk();

        $response->assertJsonPath('data.0.commissionDetails.consultationBasis', 700.0);
        $response->assertJsonPath('data.0.commissionDetails.consultationAmount', 140.0);
        $response->assertJsonPath('data.0.commissionDetails.servicesBasis', 300.0);
        $response->assertJsonPath('data.0.commissionDetails.servicesAmount', 30.0);
    }

    public function test_report_returns_zero_services_breakdown_when_services_commission_disabled(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-05',
            'earning_type' => 'COMMISSION',
            'basis_amount' => 700,
            'rate' => 20,
            'amount' => 140,
            'currency' => 'EGP',
            'status' => 'PENDING',
            'notes' => json_encode([
                'consultation_basis' => 700,
                'consultation_rate' => 20,
                'services_basis' => 0,
                'services_rate' => 0,
            ]),
        ]);

        Sanctum::actingAs($actor);

        $response = $this->getJson('/api/v1/reports/doctor-payroll?period_month=2026-05')->assertOk();

        $response->assertJsonPath('data.0.commissionDetails.consultationBasis', 700.0);
        $response->assertJsonPath('data.0.commissionDetails.servicesBasis', 0.0);
        $response->assertJsonPath('data.0.commissionDetails.servicesAmount', 0.0);
    }


    public function test_it_includes_settlement_history_in_period_report(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        $period = DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => '2026-06',
            'total_earned' => 600,
            'total_adjustments' => 0,
            'total_settled' => 250,
            'status' => 'OPEN',
        ]);

        DoctorPayrollSettlement::query()->create([
            'clinic_id' => $actor->clinic_id,
            'period_id' => $period->id,
            'settlement_date' => '2026-06-25',
            'amount' => 150,
            'settlement_kind' => 'PARTIAL',
            'method' => 'CASH',
            'reference' => 'PAY-1',
            'created_by' => $actor->id,
        ]);

        DoctorPayrollSettlement::query()->create([
            'clinic_id' => $actor->clinic_id,
            'period_id' => $period->id,
            'settlement_date' => '2026-06-27',
            'amount' => 100,
            'settlement_kind' => 'PARTIAL',
            'method' => 'BANK_TRANSFER',
            'reference' => 'PAY-2',
            'created_by' => $actor->id,
        ]);

        Sanctum::actingAs($actor);

        $response = $this->getJson('/api/v1/reports/doctor-payroll?period_month=2026-06')->assertOk();

        $response->assertJsonPath('data.0.settlements.0.reference', 'PAY-2');
        $response->assertJsonPath('data.0.settlements.0.amount', 100.0);
        $response->assertJsonPath('data.0.settlements.1.reference', 'PAY-1');
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


    public function test_it_allows_partial_settlement_before_month_end(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        $futureMonth = now()->addMonth()->format('Y-m');

        $period = DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => $futureMonth,
            'total_earned' => 400,
            'total_adjustments' => 0,
            'total_settled' => 0,
            'status' => 'OPEN',
        ]);

        Sanctum::actingAs($actor);

        $this->postJson("/api/v1/payroll/periods/{$period->id}/settle", [
            'settlement_date' => now()->format('Y-m-d'),
            'amount' => 100,
            'method' => 'cash',
            'reference' => 'PARTIAL-1',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'OPEN')
            ->assertJsonPath('data.totalSettled', 100.0);
    }

    public function test_it_allows_partial_settlement_after_period_end(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        $pastMonth = now()->subMonth()->format('Y-m');

        $period = DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => $pastMonth,
            'total_earned' => 500,
            'total_adjustments' => 0,
            'total_settled' => 0,
            'status' => 'OPEN',
        ]);

        Sanctum::actingAs($actor);

        $this->postJson("/api/v1/payroll/periods/{$period->id}/settle", [
            'settlement_date' => now()->format('Y-m-d'),
            'amount' => 200,
            'method' => 'cash',
            'reference' => 'PARTIAL-2',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'OPEN')
            ->assertJsonPath('data.totalSettled', 200.0);
    }

    public function test_it_blocks_settlement_amount_above_remaining_balance(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        $pastMonth = now()->subMonth()->format('Y-m');

        $period = DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => $pastMonth,
            'total_earned' => 250,
            'total_adjustments' => 0,
            'total_settled' => 100,
            'status' => 'CLOSED',
            'closed_at' => now(),
        ]);

        Sanctum::actingAs($actor);

        $this->postJson("/api/v1/payroll/periods/{$period->id}/settle", [
            'settlement_date' => now()->format('Y-m-d'),
            'amount' => 200,
            'method' => 'cash',
            'reference' => 'OVERPAY',
        ])->assertStatus(422);
    }


    public function test_current_month_closed_period_still_accepts_new_commission_entries_until_month_end(): void
    {
        [$actor, $doctor] = $this->createUsersInSameClinic();

        $currentMonth = now()->format('Y-m');

        DoctorPayrollPeriod::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => $currentMonth,
            'total_earned' => 100,
            'total_adjustments' => 0,
            'total_settled' => 0,
            'status' => 'CLOSED',
            'closed_at' => now(),
        ]);

        Sanctum::actingAs($actor);

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $actor->clinic_id,
            'doctor_id' => $doctor->id,
            'period_month' => $currentMonth,
            'earning_type' => 'COMMISSION',
            'basis_amount' => 100,
            'rate' => 10,
            'amount' => 10,
            'currency' => 'EGP',
            'status' => 'PENDING',
        ]);

        $this->assertDatabaseHas('doctor_earnings_ledger', [
            'doctor_id' => $doctor->id,
            'period_month' => $currentMonth,
            'earning_type' => 'COMMISSION',
            'amount' => '10.00',
        ]);
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
