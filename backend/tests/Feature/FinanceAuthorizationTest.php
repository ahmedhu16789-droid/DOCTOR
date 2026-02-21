<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\DoctorPayrollPeriod;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_process_payment_requires_finance_collect_permission_or_allowed_role(): void
    {
        [$appointment, $invoice, $admin] = $this->seedBillingContext();

        $nurse = User::factory()->create([
            'clinic_id' => $admin->clinic_id,
            'role' => 'NURSE',
        ]);

        Sanctum::actingAs($nurse);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/payments", [
            'amount' => 20,
            'method' => 'CARD',
        ])->assertForbidden();

        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/payments", [
            'amount' => 20,
            'method' => 'CARD',
        ])->assertOk();

        $invoice->refresh();
        $this->assertSame(20.0, (float) $invoice->paid_amount);
    }

    public function test_remove_item_requires_finance_remove_item_permission_or_allowed_role(): void
    {
        [$appointment, $invoice, $admin] = $this->seedBillingContext();

        $item = InvoiceItem::query()->create([
            'clinic_id' => $admin->clinic_id,
            'invoice_id' => $invoice->id,
            'name' => 'X-Ray',
            'category' => InvoiceItem::CATEGORY_PROCEDURE,
            'quantity' => 1,
            'unit_price' => 30,
            'total' => 30,
            'added_by' => $admin->id,
        ]);

        $nurse = User::factory()->create([
            'clinic_id' => $admin->clinic_id,
            'role' => 'NURSE',
        ]);

        Sanctum::actingAs($nurse);

        $this->deleteJson("/api/v1/appointments/{$appointment->id}/billing/items/{$item->id}")
            ->assertForbidden();

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/v1/appointments/{$appointment->id}/billing/items/{$item->id}")
            ->assertOk();
    }

    public function test_payroll_close_and_settle_require_payroll_permissions_or_allowed_roles(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Payroll Auth Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC'],
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
        ]);

        $admin = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
        ]);

        $period = DoctorPayrollPeriod::query()->create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'period_month' => now()->subMonth()->format('Y-m'),
            'total_earned' => 200,
            'total_adjustments' => 0,
            'total_settled' => 0,
            'status' => 'OPEN',
        ]);

        $nurse = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'NURSE',
        ]);

        Sanctum::actingAs($nurse);

        $this->postJson("/api/v1/payroll/periods/{$period->id}/close")
            ->assertForbidden();

        $this->postJson("/api/v1/payroll/periods/{$period->id}/settle", [
            'settlement_date' => now()->toDateString(),
            'amount' => 50,
            'method' => 'cash',
        ])->assertForbidden();

        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/payroll/periods/{$period->id}/close")
            ->assertOk();

        $this->postJson("/api/v1/payroll/periods/{$period->id}/settle", [
            'settlement_date' => now()->toDateString(),
            'amount' => 50,
            'method' => 'cash',
        ])->assertCreated();
    }

    /**
     * @return array{Appointment, Invoice, User}
     */
    private function seedBillingContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Billing Auth Clinic',
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

        return [$appointment, $invoice, $admin];
    }
}
