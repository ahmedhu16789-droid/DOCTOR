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

        if (in_array($contract->model, ['PERCENTAGE', 'HYBRID'], true)) {
            $this->createCommissionLedgerEntry($appointment, $invoice, $transaction, $contract, $paymentDate, $currency);
        }

        if (in_array($contract->model, ['FIXED_SALARY', 'HYBRID'], true)) {
            $this->createFixedSalaryAccrual($appointment, $contract, $paymentDate, $currency);
        }
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
        string $currency
    ): void {
        $basisPolicy = (string) config('payroll.commission_basis_policy', 'COLLECTED_AMOUNT');
        $basisAmount = $basisPolicy === 'NET_INVOICE'
            ? (float) $invoice->total
            : (float) $transaction->amount;

        $rate = (float) ($contract->commission_percentage ?? 0);
        $amount = round($basisAmount * ($rate / 100), 2);

        if ($amount <= 0) {
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
            'notes' => sprintf('Commission generated on payment using %s policy.', $basisPolicy),
        ]);
    }

    private function createFixedSalaryAccrual(
        Appointment $appointment,
        DoctorPayrollContract $contract,
        Carbon $paymentDate,
        string $currency
    ): void {
        $periodMonth = $paymentDate->format('Y-m');

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
