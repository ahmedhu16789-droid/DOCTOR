<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollContract;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AppointmentRefundTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_processes_refund_and_persists_negative_transaction_metadata_and_earnings_entry(): void
    {
        [$clinic, $appointment, $invoice, $doctor, $admin] = $this->seedBillingContext();

        DoctorPayrollContract::query()->create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'model' => 'PERCENTAGE',
            'base_salary' => 0,
            'commission_percentage' => 50,
            'effective_from' => now()->subMonth()->toDateString(),
            'effective_to' => null,
            'is_active' => true,
        ]);

        $payment = Transaction::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $invoice->id,
            'amount' => 100,
            'method' => 'CARD',
            'paid_at' => now(),
        ]);

        $invoice->update(['paid_amount' => 100, 'status' => 'PAID', 'lifecycle_state' => 'FINALIZED']);

        Sanctum::actingAs($admin);

        $response = $this->postJson("/api/v1/appointments/{$appointment->id}/billing/refunds", [
            'amount' => 40,
            'reason' => 'Patient cancellation',
            'method' => 'CARD',
            'originalTransactionId' => $payment->id,
            'reference' => 'REF-100',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.billing.paidAmount', 60.0)
            ->assertJsonPath('data.billing.status', 'PARTIAL');

        $invoice->refresh();

        $refund = Transaction::query()
            ->where('invoice_id', $invoice->id)
            ->where('amount', -40)
            ->first();

        $this->assertNotNull($refund);
        $this->assertSame('Patient cancellation', data_get($refund->metadata, 'reason'));
        $this->assertSame($payment->id, data_get($refund->metadata, 'original_transaction_id'));
        $this->assertSame('REF-100', data_get($refund->metadata, 'original_transaction_reference'));

        $this->assertSame(60.0, (float) $invoice->paid_amount);
        $this->assertSame('PARTIAL', $invoice->status);

        $ledgerEntry = DoctorEarningsLedger::query()
            ->where('transaction_id', $refund->id)
            ->first();

        $this->assertNotNull($ledgerEntry);
        $this->assertSame(-20.0, (float) $ledgerEntry->amount);
    }

    public function test_it_rejects_refunds_when_actor_does_not_have_permission(): void
    {
        [, $appointment, $invoice, , $admin] = $this->seedBillingContext();

        $invoice->update(['paid_amount' => 100, 'status' => 'PAID', 'lifecycle_state' => 'FINALIZED']);

        $nurse = User::factory()->create([
            'clinic_id' => $admin->clinic_id,
            'role' => 'NURSE',
        ]);

        Sanctum::actingAs($nurse);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/refunds", [
            'amount' => 10,
            'reason' => 'Unauthorized test',
        ])->assertForbidden();
    }

    public function test_it_prevents_over_refunding_beyond_paid_amount(): void
    {
        [, $appointment, $invoice, , $admin] = $this->seedBillingContext();

        $invoice->update(['paid_amount' => 100, 'status' => 'PAID', 'lifecycle_state' => 'FINALIZED']);

        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/refunds", [
            'amount' => 120,
            'reason' => 'Over refund should fail',
        ])->assertStatus(422);

        $this->assertDatabaseMissing('transactions', [
            'invoice_id' => $invoice->id,
            'amount' => -120,
        ]);
    }

    /**
     * @return array{Clinic, Appointment, Invoice, User, User}
     */
    private function seedBillingContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Refund Test Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP', 'commission_basis' => 'PAID_AMOUNT', 'clawback_on_refund' => true],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Cairo',
            'contact_phone' => '01000000001',
            'is_active' => true,
        ]);

        $admin = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
        ]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '01010000001',
            'gender' => 'Male',
            'age' => 29,
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now()->toDateString(),
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        $invoice = Invoice::query()->create([
            'clinic_id' => $clinic->id,
            'appointment_id' => $appointment->id,
            'total' => 100,
            'paid_amount' => 0,
            'status' => 'UNPAID',
            'lifecycle_state' => 'DRAFT',
        ]);

        return [$clinic, $appointment, $invoice, $doctor, $admin];
    }
}
