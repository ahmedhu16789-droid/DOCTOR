<?php

namespace Tests\Unit;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollContract;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\Transaction;
use App\Models\User;
use App\Services\DoctorEarningsCalculator;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DoctorEarningsCalculatorTest extends TestCase
{
    use RefreshDatabase;

    public function test_fixed_salary_contract_creates_single_monthly_accrual(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();
        $this->createContract($clinic, $doctor, 'FIXED_SALARY', 10000, null, '2026-02-01');

        $transaction = $this->createTransaction($clinic, $invoice, 500, '2026-02-15');

        app(DoctorEarningsCalculator::class)->recordForPayment($appointment, $invoice, $transaction);

        $entry = DoctorEarningsLedger::query()->firstOrFail();

        $this->assertSame('FIXED_SALARY_ACCRUAL', $entry->earning_type);
        $this->assertEquals(10000.0, (float) $entry->amount);
        $this->assertSame('2026-02', $entry->period_month);
    }

    public function test_percentage_contract_uses_paid_amount_with_partial_payment(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();
        $clinic->update(['settings' => ['currency' => 'EGP', 'commission_basis' => 'PAID_AMOUNT']]);

        $this->createContract($clinic, $doctor, 'PERCENTAGE', 0, 20, '2026-02-01');

        $transaction = $this->createTransaction($clinic, $invoice, 250, '2026-02-10');

        app(DoctorEarningsCalculator::class)->recordForPayment($appointment, $invoice, $transaction);

        $entry = DoctorEarningsLedger::query()->firstOrFail();

        $this->assertSame('COMMISSION', $entry->earning_type);
        $this->assertEquals(250.0, (float) $entry->basis_amount);
        $this->assertEquals(50.0, (float) $entry->amount);
    }


    public function test_percentage_contract_without_additional_services_commission_uses_only_consultation_items(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();

        $contract = $this->createContract($clinic, $doctor, 'PERCENTAGE', 0, 20, '2026-02-01');
        $contract->update(['additional_services_commission_enabled' => false]);

        InvoiceItem::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $invoice->id,
            'name' => 'Consultation',
            'category' => 'CONSULTATION',
            'quantity' => 1,
            'unit_price' => 700,
            'total' => 700,
        ]);

        InvoiceItem::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $invoice->id,
            'name' => 'X-Ray',
            'category' => 'SERVICE',
            'quantity' => 1,
            'unit_price' => 300,
            'total' => 300,
        ]);

        $transaction = $this->createTransaction($clinic, $invoice, 1000, '2026-02-10');

        app(DoctorEarningsCalculator::class)->recordForPayment($appointment, $invoice, $transaction);

        $entry = DoctorEarningsLedger::query()->firstOrFail();

        $this->assertSame('COMMISSION', $entry->earning_type);
        $this->assertEquals(700.0, (float) $entry->basis_amount);
        $this->assertEquals(140.0, (float) $entry->amount);
    }

    public function test_hybrid_contract_generates_commission_and_fixed_salary_entries(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();
        $this->createContract($clinic, $doctor, 'HYBRID', 8000, 10, '2026-02-01');

        $transaction = $this->createTransaction($clinic, $invoice, 300, '2026-02-12');

        app(DoctorEarningsCalculator::class)->recordForPayment($appointment, $invoice, $transaction);

        $this->assertSame(2, DoctorEarningsLedger::query()->count());
        $this->assertSame(1, DoctorEarningsLedger::query()->where('earning_type', 'COMMISSION')->count());
        $this->assertSame(1, DoctorEarningsLedger::query()->where('earning_type', 'FIXED_SALARY_ACCRUAL')->count());
    }

    public function test_refund_creates_negative_clawback_when_policy_enabled(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();
        $clinic->update(['settings' => ['currency' => 'EGP', 'clawback_on_refund' => true, 'commission_basis' => 'PAID_AMOUNT']]);
        $this->createContract($clinic, $doctor, 'PERCENTAGE', 0, 15, '2026-02-01');

        $refund = $this->createTransaction($clinic, $invoice, -100, '2026-02-14');

        app(DoctorEarningsCalculator::class)->recordForPayment($appointment, $invoice, $refund);

        $entry = DoctorEarningsLedger::query()->firstOrFail();

        $this->assertEquals(-100.0, (float) $entry->basis_amount);
        $this->assertEquals(-15.0, (float) $entry->amount);
    }

    public function test_refund_is_ignored_when_clawback_policy_is_disabled(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();
        $clinic->update(['settings' => ['currency' => 'EGP', 'clawback_on_refund' => false, 'commission_basis' => 'PAID_AMOUNT']]);
        $this->createContract($clinic, $doctor, 'PERCENTAGE', 0, 15, '2026-02-01');

        $refund = $this->createTransaction($clinic, $invoice, -100, '2026-02-14');

        app(DoctorEarningsCalculator::class)->recordForPayment($appointment, $invoice, $refund);

        $this->assertSame(0, DoctorEarningsLedger::query()->count());
    }

    public function test_contract_change_mid_month_uses_active_contract_on_payment_date(): void
    {
        [$clinic, $doctor, $appointment, $invoice] = $this->createAppointmentContext();

        $this->createContract($clinic, $doctor, 'PERCENTAGE', 0, 10, '2026-02-01', '2026-02-15');
        $this->createContract($clinic, $doctor, 'PERCENTAGE', 0, 25, '2026-02-16');

        $calculator = app(DoctorEarningsCalculator::class);

        $firstPayment = $this->createTransaction($clinic, $invoice, 100, '2026-02-10');
        $calculator->recordForPayment($appointment, $invoice, $firstPayment);

        $secondPayment = $this->createTransaction($clinic, $invoice, 100, '2026-02-20');
        $calculator->recordForPayment($appointment, $invoice, $secondPayment);

        $amounts = DoctorEarningsLedger::query()
            ->orderBy('id')
            ->pluck('amount')
            ->map(static fn ($amount) => (float) $amount)
            ->all();

        $this->assertSame([10.0, 25.0], $amounts);
    }

    /**
     * @return array{0: Clinic, 1: User, 2: Appointment, 3: Invoice}
     */
    private function createAppointmentContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Calculator Clinic',
            'subscription_status' => 'trial',
            'settings' => [
                'currency' => 'EGP',
                'commission_basis' => 'PAID_AMOUNT',
                'apply_on_discounted_amount' => true,
                'include_tax' => true,
                'clawback_on_refund' => true,
                'accrual_day_of_month' => 1,
            ],
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main',
            'location' => 'Cairo',
            'contact_phone' => '+201000000000',
            'is_active' => true,
        ]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '+201011111111',
            'gender' => 'Male',
            'age' => 30,
            'medical_history_summary' => '',
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => '2026-02-10',
            'time_slot' => '10:00',
            'status' => 'SCHEDULED',
        ]);

        $invoice = Invoice::query()->create([
            'clinic_id' => $clinic->id,
            'appointment_id' => $appointment->id,
            'total' => 1000,
            'paid_amount' => 0,
            'status' => 'UNPAID',
        ]);

        return [$clinic, $doctor, $appointment, $invoice];
    }

    private function createContract(
        Clinic $clinic,
        User $doctor,
        string $model,
        float $baseSalary,
        ?float $commission,
        string $from,
        ?string $to = null
    ): DoctorPayrollContract {
        return DoctorPayrollContract::query()->create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'model' => $model,
            'base_salary' => $baseSalary,
            'commission_percentage' => $commission,
            'effective_from' => $from,
            'effective_to' => $to,
            'is_active' => true,
        ]);
    }

    private function createTransaction(Clinic $clinic, Invoice $invoice, float $amount, string $date): Transaction
    {
        return Transaction::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $invoice->id,
            'amount' => $amount,
            'method' => 'cash',
            'paid_at' => Carbon::parse($date),
        ]);
    }
}
