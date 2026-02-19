<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollContract;
use App\Models\Invoice;
use App\Models\Transaction;
use Carbon\Carbon;

class DoctorEarningsCalculator
{
    public function recordForPayment(Appointment $appointment, Invoice $invoice, Transaction $transaction): void
    {
        if (! $appointment->doctor_id) {
            return;
        }

        $paymentDate = $transaction->paid_at ? Carbon::parse($transaction->paid_at) : now();

        $contract = $this->resolveActiveContract(
            (int) $appointment->clinic_id,
            (int) $appointment->doctor_id,
            $paymentDate
        );

        if (! $contract) {
            return;
        }

        $currency = $this->resolveCurrency((int) $appointment->clinic_id);

        $policy = $this->resolvePolicy((int) $appointment->clinic_id);

        if (in_array($contract->model, ['PERCENTAGE', 'HYBRID'], true)) {
            $this->createCommissionLedgerEntry($appointment, $invoice, $transaction, $contract, $paymentDate, $currency, $policy);
        }

        if (in_array($contract->model, ['FIXED_SALARY', 'HYBRID'], true)) {
            $this->createFixedSalaryAccrual($appointment, $contract, $paymentDate, $currency, $policy['accrual_day_of_month']);
        }
    }

    /**
     * @return array{commission_basis: string, apply_on_discounted_amount: bool, include_tax: bool, clawback_on_refund: bool, accrual_day_of_month: int}
     */
    private function resolvePolicy(int $clinicId): array
    {
        /** @var Clinic|null $clinic */
        $clinic = Clinic::query()->find($clinicId);
        $settings = $clinic?->settings ?? [];

        return [
            'commission_basis' => in_array(data_get($settings, 'commission_basis'), ['PAID_AMOUNT', 'INVOICE_TOTAL'], true)
                ? data_get($settings, 'commission_basis')
                : 'PAID_AMOUNT',
            'apply_on_discounted_amount' => (bool) data_get($settings, 'apply_on_discounted_amount', true),
            'include_tax' => (bool) data_get($settings, 'include_tax', true),
            'clawback_on_refund' => (bool) data_get($settings, 'clawback_on_refund', true),
            'accrual_day_of_month' => max(1, min(28, (int) data_get($settings, 'accrual_day_of_month', 1))),
        ];
    }

    private function resolveActiveContract(int $clinicId, int $doctorId, Carbon $referenceDate): ?DoctorPayrollContract
    {
        return DoctorPayrollContract::query()
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $doctorId)
            ->where('is_active', true)
            ->whereDate('effective_from', '<=', $referenceDate->toDateString())
            ->where(function ($query) use ($referenceDate): void {
                $query->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $referenceDate->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();
    }

    private function createCommissionLedgerEntry(
        Appointment $appointment,
        Invoice $invoice,
        Transaction $transaction,
        DoctorPayrollContract $contract,
        Carbon $paymentDate,
        string $currency,
        array $policy
    ): void {
        $transactionAmount = (float) $transaction->amount;
        if ($transactionAmount < 0 && ! $policy['clawback_on_refund']) {
            return;
        }

        $basisAmount = $this->resolveCommissionBasis($invoice, $transactionAmount, $policy);

        $rate = (float) ($contract->commission_percentage ?? 0);
        $amount = round($basisAmount * ($rate / 100), 2);

        if ($amount === 0.0) {
            return;
        }

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $appointment->clinic_id,
            'doctor_id' => $appointment->doctor_id,
            'appointment_id' => $appointment->id,
            'invoice_id' => $invoice->id,
            'transaction_id' => $transaction->id,
            'period_month' => $paymentDate->format('Y-m'),
            'earning_type' => 'COMMISSION',
            'basis_amount' => $basisAmount,
            'rate' => $rate,
            'amount' => $amount,
            'currency' => $currency,
            'status' => 'PENDING',
            'notes' => sprintf('Commission generated using clinic policy basis %s.', $policy['commission_basis']),
        ]);
    }

    /**
     * @param array{commission_basis: string, apply_on_discounted_amount: bool, include_tax: bool, clawback_on_refund: bool, accrual_day_of_month: int} $policy
     */
    private function resolveCommissionBasis(Invoice $invoice, float $transactionAmount, array $policy): float
    {
        $invoiceTotal = (float) $invoice->total;
        $discountAmount = max(0.0, (float) data_get($invoice, 'discount_amount', 0));
        $taxAmount = max(0.0, (float) data_get($invoice, 'tax_amount', 0));

        $invoiceBasis = $policy['apply_on_discounted_amount']
            ? $invoiceTotal
            : $invoiceTotal + $discountAmount;

        if (! $policy['include_tax']) {
            $invoiceBasis -= $taxAmount;
        }

        if ($policy['commission_basis'] === 'INVOICE_TOTAL') {
            return max(0, $invoiceBasis);
        }

        if ($invoiceTotal <= 0) {
            return $transactionAmount;
        }

        $ratio = $transactionAmount / $invoiceTotal;

        return round($invoiceBasis * $ratio, 2);
    }

    private function createFixedSalaryAccrual(
        Appointment $appointment,
        DoctorPayrollContract $contract,
        Carbon $paymentDate,
        string $currency,
        int $accrualDayOfMonth
    ): void {
        $periodDate = $paymentDate->copy();
        if ($periodDate->day < $accrualDayOfMonth) {
            $periodDate->subMonthNoOverflow();
        }

        $periodMonth = $periodDate->format('Y-m');

        $exists = DoctorEarningsLedger::query()
            ->where('clinic_id', $appointment->clinic_id)
            ->where('doctor_id', $appointment->doctor_id)
            ->where('period_month', $periodMonth)
            ->where('earning_type', 'FIXED_SALARY_ACCRUAL')
            ->exists();

        if ($exists) {
            return;
        }

        $baseSalary = (float) $contract->base_salary;

        if ($baseSalary <= 0) {
            return;
        }

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $appointment->clinic_id,
            'doctor_id' => $appointment->doctor_id,
            'period_month' => $periodMonth,
            'earning_type' => 'FIXED_SALARY_ACCRUAL',
            'basis_amount' => $baseSalary,
            'rate' => null,
            'amount' => $baseSalary,
            'currency' => $currency,
            'status' => 'PENDING',
            'notes' => 'Monthly fixed salary accrual generated automatically.',
        ]);
    }

    private function resolveCurrency(int $clinicId): string
    {
        /** @var Clinic|null $clinic */
        $clinic = Clinic::query()->find($clinicId);

        return strtoupper((string) data_get($clinic?->settings, 'currency', config('app.currency', 'USD')));
    }
}
