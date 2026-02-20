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

        $defaultRate = (float) ($contract->commission_percentage ?? 0);
        $additionalServicesEnabled = (bool) ($contract->additional_services_commission_enabled ?? false);

        if (! $additionalServicesEnabled) {
            $consultationOnly = $this->resolveConsultationOnlyBasis($invoice, $basisAmount, $transactionAmount);

            if (! $consultationOnly['hasConsultation']) {
                DoctorEarningsLedger::query()->create([
                    'clinic_id' => $appointment->clinic_id,
                    'doctor_id' => $appointment->doctor_id,
                    'appointment_id' => $appointment->id,
                    'invoice_id' => $invoice->id,
                    'transaction_id' => $transaction->id,
                    'period_month' => $paymentDate->format('Y-m'),
                    'earning_type' => 'COMMISSION',
                    'basis_amount' => 0,
                    'rate' => $defaultRate,
                    'amount' => 0,
                    'currency' => $currency,
                    'status' => 'PENDING',
                    'notes' => $this->buildCommissionNotes(
                        consultationBasis: 0.0,
                        consultationRate: $defaultRate,
                        servicesBasis: 0.0,
                        servicesRate: 0.0,
                        policyBasis: (string) $policy['commission_basis']
                    ),
                ]);

                return;
            }

            $consultationBasis = $consultationOnly['basis'];
            $amount = round($consultationBasis * ($defaultRate / 100), 2);

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
                'basis_amount' => $consultationBasis,
                'rate' => $defaultRate,
                'amount' => $amount,
                'currency' => $currency,
                'status' => 'PENDING',
                'notes' => $this->buildCommissionNotes(
                    consultationBasis: $consultationBasis,
                    consultationRate: $defaultRate,
                    servicesBasis: 0.0,
                    servicesRate: 0.0,
                    policyBasis: (string) $policy['commission_basis']
                ),
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
            'notes' => $this->buildCommissionNotes(
                consultationBasis: $breakdown['consultation'] * $direction,
                consultationRate: $defaultRate,
                servicesBasis: $breakdown['additionalServices'] * $direction,
                servicesRate: $additionalRate,
                policyBasis: (string) $policy['commission_basis']
            ),
        ]);
    }

    private function buildCommissionNotes(
        float $consultationBasis,
        float $consultationRate,
        float $servicesBasis,
        float $servicesRate,
        string $policyBasis
    ): string {
        return (string) json_encode([
            'consultation_basis' => round($consultationBasis, 2),
            'consultation_rate' => round($consultationRate, 4),
            'services_basis' => round($servicesBasis, 2),
            'services_rate' => round($servicesRate, 4),
            'policy_basis' => $policyBasis,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * @return array{basis: float, hasConsultation: bool}
     */
    private function resolveConsultationOnlyBasis(Invoice $invoice, float $basisAmount, float $transactionAmount): array
    {
        $items = $invoice->relationLoaded('items') ? $invoice->items : $invoice->items()->get();
        $consultationItems = $items->filter(
            fn ($item) => strtoupper((string) ($item->category ?? '')) === 'CONSULTATION'
        );

        if ($consultationItems->isEmpty()) {
            return [
                'basis' => 0.0,
                'hasConsultation' => false,
            ];
        }

        $consultationTotal = max((float) $consultationItems->sum('total'), 0.0);
        $itemsTotal = max((float) $items->sum('total'), 0.0);

        if ($itemsTotal <= 0.0) {
            return [
                'basis' => 0.0,
                'hasConsultation' => true,
            ];
        }

        $invoiceTotal = max((float) $invoice->total, 0.0);
        $coveredTotal = $invoiceTotal > 0 ? min(abs($transactionAmount) / $invoiceTotal, 1) * $itemsTotal : $itemsTotal;
        $basisCoverageRatio = min($coveredTotal / $itemsTotal, 1);
        $direction = $basisAmount < 0 ? -1 : 1;

        return [
            'basis' => round($consultationTotal * $basisCoverageRatio, 2) * $direction,
            'hasConsultation' => true,
        ];
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
