<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\CashSession;
use App\Models\Clinic;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\ReconciliationSummary;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashSessionReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_closes_cash_session_and_computes_variance_from_cash_transactions_only(): void
    {
        Carbon::setTestNow('2026-02-23 10:00:00');

        [$clinic, $branch, $actor] = $this->seedClinicBranchActor();
        $doctor = User::factory()->create(['clinic_id' => $clinic->id, 'role' => 'DOCTOR']);

        $session = CashSession::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'opened_by' => $actor->id,
            'opening_balance' => 100,
            'expected_cash' => 100,
            'opened_at' => now(),
            'status' => 'OPEN',
        ]);

        $appointment = $this->seedAppointmentWithInvoice($clinic->id, $branch->id, $doctor->id, 300);

        Sanctum::actingAs($actor);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/payments", [
            'payments' => [
                ['amount' => 50, 'method' => 'CASH'],
                ['amount' => 25, 'method' => 'CARD'],
            ],
        ])->assertOk();

        $cashTx = Transaction::query()->where('invoice_id', $appointment->invoice->id)->where('method', 'CASH')->first();
        $cardTx = Transaction::query()->where('invoice_id', $appointment->invoice->id)->where('method', 'CARD')->first();

        $this->assertNotNull($cashTx);
        $this->assertSame($session->id, $cashTx->cash_session_id);
        $this->assertNull($cardTx?->cash_session_id);

        $this->postJson("/api/v1/cash-sessions/{$session->id}/close", [
            'collected_cash' => 140,
        ])->assertOk()
            ->assertJsonPath('data.expectedCash', 150.0)
            ->assertJsonPath('data.variance', -10.0)
            ->assertJsonPath('data.status', 'CLOSED');

        $this->assertDatabaseHas('reconciliation_summaries', [
            'cash_session_id' => $session->id,
            'branch_id' => $branch->id,
            'expected_cash' => 150,
            'collected_cash' => 140,
            'variance' => -10,
        ]);
    }

    public function test_reconciliation_report_supports_branch_filtering(): void
    {
        Carbon::setTestNow('2026-02-23 12:00:00');

        [$clinic, $branchA, $actor] = $this->seedClinicBranchActor();
        $branchB = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch B',
            'location' => 'Giza',
            'contact_phone' => '01000000002',
            'is_active' => true,
        ]);

        $sessionA = CashSession::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branchA->id,
            'opened_by' => $actor->id,
            'closed_by' => $actor->id,
            'opening_balance' => 10,
            'expected_cash' => 20,
            'collected_cash' => 18,
            'variance' => -2,
            'opened_at' => now()->subHours(2),
            'closed_at' => now(),
            'status' => 'CLOSED',
        ]);

        $sessionB = CashSession::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branchB->id,
            'opened_by' => $actor->id,
            'closed_by' => $actor->id,
            'opening_balance' => 15,
            'expected_cash' => 30,
            'collected_cash' => 35,
            'variance' => 5,
            'opened_at' => now()->subHours(3),
            'closed_at' => now(),
            'status' => 'CLOSED',
        ]);

        ReconciliationSummary::query()->insert([
            [
                'clinic_id' => $clinic->id,
                'branch_id' => $branchA->id,
                'cash_session_id' => $sessionA->id,
                'closed_by' => $actor->id,
                'reconciliation_date' => now()->toDateString(),
                'opening_balance' => 10,
                'expected_cash' => 20,
                'collected_cash' => 18,
                'variance' => -2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'clinic_id' => $clinic->id,
                'branch_id' => $branchB->id,
                'cash_session_id' => $sessionB->id,
                'closed_by' => $actor->id,
                'reconciliation_date' => now()->toDateString(),
                'opening_balance' => 15,
                'expected_cash' => 30,
                'collected_cash' => 35,
                'variance' => 5,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        Sanctum::actingAs($actor);

        $this->getJson('/api/v1/reports/reconciliation?date=2026-02-23')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/v1/reports/reconciliation?date=2026-02-23&branch_id='.$branchA->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.branchId', (string) $branchA->id);
    }

    private function seedClinicBranchActor(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Cash Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Cairo',
            'contact_phone' => '01000000001',
            'is_active' => true,
        ]);

        $actor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
        ]);

        return [$clinic, $branch, $actor];
    }

    private function seedAppointmentWithInvoice(int $clinicId, int $branchId, int $doctorId, float $invoiceTotal): Appointment
    {
        $patient = Patient::query()->create([
            'clinic_id' => $clinicId,
            'name' => 'Cash Patient',
            'phone' => '01099999999',
            'gender' => 'Male',
            'age' => 31,
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinicId,
            'branch_id' => $branchId,
            'patient_id' => $patient->id,
            'doctor_id' => $doctorId,
            'date' => now()->toDateString(),
            'time_slot' => '11:00',
            'status' => 'SCHEDULED',
        ]);

        Invoice::query()->create([
            'clinic_id' => $clinicId,
            'appointment_id' => $appointment->id,
            'total' => $invoiceTotal,
            'paid_amount' => 0,
            'status' => 'UNPAID',
        ]);

        return $appointment->fresh(['invoice']);
    }
}
