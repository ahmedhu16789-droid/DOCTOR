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

        if (in_array($contract->model, ['FIXED_SALARY', 'HYBRID', 'HYBRID_PER_CASE'], true)) {
            $this->createFixedSalaryAccrual($appointment, $contract, $paymentDate, $currency, $policy['accrual_day_of_month']);
        }

        if (in_array($contract->model, ['PER_CASE', 'HYBRID_PER_CASE'], true)) {
            $this->createPerCaseAccruals((int) $appointment->clinic_id, (int) $appointment->doctor_id, $paymentDate, $currency);
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

        $defaultRate = (float) ($contract->commission_percentage ?? 0);
        $additionalServicesEnabled = (bool) ($contract->additional_services_commission_enabled ?? false);

        if (! $additionalServicesEnabled) {
            $amount = round($basisAmount * ($defaultRate / 100), 2);

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
                'rate' => $defaultRate,
                'amount' => $amount,
                'currency' => $currency,
                'status' => 'PENDING',
                'notes' => sprintf('Commission generated using clinic policy basis %s.', $policy['commission_basis']),
            ]);

            return;
        }

        $breakdown = $this->resolvePaidServiceBreakdown($invoice, $basisAmount, $transactionAmount);
        $additionalRate = (float) ($contract->additional_services_commission_percentage ?? 0);

        $direction = $basisAmount < 0 ? -1 : 1;
        $consultationAmount = round($breakdown['consultation'] * ($defaultRate / 100), 2) * $direction;
        $additionalAmount = round($breakdown['additionalServices'] * ($additionalRate / 100), 2) * $direction;
        $totalAmount = round($consultationAmount + $additionalAmount, 2);

        if ($totalAmount === 0.0) {
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
            'rate' => null,
            'amount' => $totalAmount,
            'currency' => $currency,
            'status' => 'PENDING',
            'notes' => sprintf(
                'Commission split: consultation %.2f%%, additional services %.2f%%. Policy basis %s.',
                $defaultRate,
                $additionalRate,
                $policy['commission_basis']
            ),
        ]);
    }

    /**
     * @return array{consultation: float, additionalServices: float}
     */
    private function resolvePaidServiceBreakdown(Invoice $invoice, float $basisAmount, float $transactionAmount): array
    {
        $items = $invoice->relationLoaded('items') ? $invoice->items : $invoice->items()->get();

        $consultationTotal = (float) $items
            ->filter(fn ($item) => strtoupper((string) ($item->category ?? '')) === 'CONSULTATION')
            ->sum('total');

        $itemsTotal = max((float) $items->sum('total'), 0.0);
        $additionalServicesTotal = max($itemsTotal - $consultationTotal, 0.0);

        if ($itemsTotal <= 0.0) {
            return [
                'consultation' => $basisAmount,
                'additionalServices' => 0.0,
            ];
        }

        $invoiceTotal = max((float) $invoice->total, 0.0);
        $coveredTotal = $invoiceTotal > 0 ? min(abs($transactionAmount) / $invoiceTotal, 1) * $itemsTotal : $itemsTotal;
        $basisCoverageRatio = min($coveredTotal / $itemsTotal, 1);

        return [
            'consultation' => round($consultationTotal * $basisCoverageRatio, 2),
            'additionalServices' => round($additionalServicesTotal * $basisCoverageRatio, 2),
        ];
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


    private function createPerCaseAccruals(int $clinicId, int $doctorId, Carbon $paymentDate, string $currency): void
    {
        $periodMonth = $paymentDate->format('Y-m');
        $periodStart = Carbon::createFromFormat('Y-m-d', $periodMonth.'-01')->startOfDay();
        $periodEnd = $periodStart->copy()->endOfMonth();

        $contracts = DoctorPayrollContract::query()
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $doctorId)
            ->where('is_active', true)
            ->whereIn('model', ['PER_CASE', 'HYBRID_PER_CASE'])
            ->whereDate('effective_from', '<=', $periodEnd->toDateString())
            ->where(function ($query) use ($periodStart): void {
                $query->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $periodStart->toDateString());
            })
            ->orderBy('effective_from')
            ->get();

        foreach ($contracts as $contract) {
            $this->createPerCaseAccrualForContract($clinicId, $doctorId, $periodMonth, $periodStart, $periodEnd, $contract, $currency);
        }
    }

    private function createPerCaseAccrualForContract(
        int $clinicId,
        int $doctorId,
        string $periodMonth,
        Carbon $periodStart,
        Carbon $periodEnd,
        DoctorPayrollContract $contract,
        string $currency
    ): void {
        $entryExists = DoctorEarningsLedger::query()
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $doctorId)
            ->where('period_month', $periodMonth)
            ->where('earning_type', 'PER_CASE_ACCRUAL')
            ->where('notes', 'like', '%[contract:'.$contract->id.']%')
            ->exists();

        if ($entryExists) {
            return;
        }

        $perCaseAmount = (float) ($contract->per_case_amount ?? 0);

        if ($perCaseAmount <= 0.0) {
            return;
        }

        $effectiveFrom = Carbon::parse($contract->effective_from)->startOfDay();
        $effectiveTo = $contract->effective_to ? Carbon::parse($contract->effective_to)->endOfDay() : $periodEnd;

        $windowStart = $effectiveFrom->greaterThan($periodStart) ? $effectiveFrom : $periodStart;
        $windowEnd = $effectiveTo->lessThan($periodEnd) ? $effectiveTo : $periodEnd;

        if ($windowStart->greaterThan($windowEnd)) {
            return;
        }

        $capCases = $contract->per_day_cap_cases ? (int) $contract->per_day_cap_cases : null;

        $completedCases = Appointment::query()
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $doctorId)
            ->where('status', 'COMPLETED')
            ->whereDate('date', '>=', $windowStart->toDateString())
            ->whereDate('date', '<=', $windowEnd->toDateString())
            ->selectRaw('date, COUNT(*) as cases_count')
            ->groupBy('date')
            ->get()
            ->sum(function ($row) use ($capCases): int {
                $casesCount = (int) $row->cases_count;

                return $capCases ? min($casesCount, $capCases) : $casesCount;
            });

        if ($completedCases <= 0) {
            return;
        }

        $totalAmount = round($completedCases * $perCaseAmount, 2);

        DoctorEarningsLedger::query()->create([
            'clinic_id' => $clinicId,
            'doctor_id' => $doctorId,
            'period_month' => $periodMonth,
            'earning_type' => 'PER_CASE_ACCRUAL',
            'basis_amount' => $completedCases,
            'rate' => null,
            'amount' => $totalAmount,
            'currency' => $currency,
            'status' => 'PENDING',
            'notes' => sprintf(
                'Per-case accrual generated for %d completed case(s) at %.2f per case%s. [contract:%d]',
                $completedCases,
                $perCaseAmount,
                $capCases ? sprintf(' with daily cap %d', $capCases) : '',
                $contract->id
            ),
        ]);
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
