<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollContract;
use App\Models\DoctorPayrollPeriod;
use App\Models\DoctorPayrollSettlement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DoctorPayrollController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $periodMonth = $request->query('period_month') ?: now()->format('Y-m');
        $doctorId = $request->query('doctor_id');
        $branchId = $request->query('branch_id');
        $status = $request->query('status');

        $this->ensureMonthlyFixedSalaryAccruals((int) $request->user()->clinic_id, $periodMonth, $doctorId ?: null);

        $rows = DoctorEarningsLedger::query()
            ->selectRaw(
                'doctor_id, period_month,
                SUM(CASE WHEN earning_type IN (?, ?, ?) THEN amount ELSE 0 END) as total_earned,
                SUM(CASE WHEN earning_type = ? THEN amount ELSE 0 END) as total_adjustments',
                ['COMMISSION', 'FIXED_SALARY_ACCRUAL', 'CLAWBACK', 'ADJUSTMENT']
            )
            ->with('doctor:id,name')
            ->when($periodMonth, fn ($query) => $query->where('period_month', $periodMonth))
            ->when($doctorId, fn ($query) => $query->where('doctor_id', $doctorId))
            ->when($branchId, function ($query) use ($branchId): void {
                $query->whereHas('doctor.branches', fn ($doctorQuery) => $doctorQuery->where('branches.id', (int) $branchId));
            })
            ->groupBy('doctor_id', 'period_month')
            ->orderByDesc('period_month')
            ->get();

        $data = $rows->map(function (DoctorEarningsLedger $row): array {
            $period = DoctorPayrollPeriod::query()->firstOrCreate(
                [
                    'doctor_id' => $row->doctor_id,
                    'period_month' => $row->period_month,
                ],
                [
                    'total_earned' => 0,
                    'total_adjustments' => 0,
                    'total_settled' => 0,
                    'status' => 'OPEN',
                ]
            );

            $period->forceFill([
                'total_earned' => (float) $row->total_earned,
                'total_adjustments' => (float) $row->total_adjustments,
            ])->save();

            return [
                'periodId' => $period->id,
                'doctorId' => (int) $row->doctor_id,
                'doctorName' => $row->doctor?->name,
                'periodMonth' => $row->period_month,
                'totalEarned' => (float) $period->total_earned,
                'totalAdjustments' => (float) $period->total_adjustments,
                'totalSettled' => (float) $period->total_settled,
                'status' => $period->status,
                'closedAt' => optional($period->closed_at)?->toISOString(),
            ];
        })->values();

        if ($status) {
            $data = $data->filter(fn (array $row) => $row['status'] === $status)->values();
        }

        return response()->json(['data' => $data]);
    }

    private function ensureMonthlyFixedSalaryAccruals(int $clinicId, string $periodMonth, ?string $doctorId = null): void
    {
        $periodStart = $periodMonth.'-01';
        $periodEnd = date('Y-m-t', strtotime($periodStart));

        DoctorPayrollContract::query()
            ->where('clinic_id', $clinicId)
            ->whereIn('model', ['FIXED_SALARY', 'HYBRID', 'HYBRID_PER_CASE'])
            ->where('base_salary', '>', 0)
            ->whereDate('effective_from', '<=', $periodEnd)
            ->where(function ($query) use ($periodStart): void {
                $query->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $periodStart);
            })
            ->when($doctorId, fn ($query) => $query->where('doctor_id', (int) $doctorId))
            ->get()
            ->each(function (DoctorPayrollContract $contract) use ($periodMonth, $clinicId): void {
                $alreadyExists = DoctorEarningsLedger::query()
                    ->where('clinic_id', $clinicId)
                    ->where('doctor_id', $contract->doctor_id)
                    ->where('period_month', $periodMonth)
                    ->where('earning_type', 'FIXED_SALARY_ACCRUAL')
                    ->exists();

                if ($alreadyExists) {
                    return;
                }

                DoctorEarningsLedger::query()->create([
                    'clinic_id' => $clinicId,
                    'doctor_id' => $contract->doctor_id,
                    'period_month' => $periodMonth,
                    'earning_type' => 'FIXED_SALARY_ACCRUAL',
                    'basis_amount' => $contract->base_salary,
                    'rate' => null,
                    'amount' => $contract->base_salary,
                    'currency' => strtoupper((string) config('app.currency', 'USD')),
                    'status' => 'PENDING',
                    'notes' => 'Monthly fixed salary accrual generated from active payroll contract.',
                ]);
            });
    }

    public function close(int $id): JsonResponse
    {
        /** @var DoctorPayrollPeriod $period */
        $period = DoctorPayrollPeriod::query()->findOrFail($id);

        if ($period->status === 'SETTLED') {
            return response()->json(['message' => 'Payroll period already settled.'], 422);
        }

        $period->status = 'CLOSED';
        $period->closed_at = now();
        $period->save();

        return response()->json([
            'message' => 'Payroll period closed successfully.',
            'data' => [
                'id' => $period->id,
                'status' => $period->status,
                'closedAt' => optional($period->closed_at)?->toISOString(),
            ],
        ]);
    }

    public function settle(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'settlement_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:255'],
        ]);

        /** @var DoctorPayrollPeriod $period */
        $period = DoctorPayrollPeriod::query()->findOrFail($id);

        DB::transaction(function () use ($period, $validated): void {
            DoctorPayrollSettlement::query()->create([
                'period_id' => $period->id,
                'settlement_date' => $validated['settlement_date'],
                'amount' => $validated['amount'],
                'method' => strtoupper((string) $validated['method']),
                'reference' => $validated['reference'] ?? null,
                'created_by' => auth()->id(),
            ]);

            $period->refresh();
            $period->total_settled = (float) DoctorPayrollSettlement::query()
                ->where('period_id', $period->id)
                ->sum('amount');

            $targetAmount = (float) $period->total_earned + (float) $period->total_adjustments;

            if ($period->total_settled >= $targetAmount && $targetAmount > 0) {
                $period->status = 'SETTLED';
            } elseif ($period->status === 'OPEN') {
                $period->status = 'CLOSED';
                $period->closed_at = $period->closed_at ?? now();
            }

            $period->save();
        });

        $period->refresh();

        return response()->json([
            'message' => 'Settlement recorded successfully.',
            'data' => [
                'id' => $period->id,
                'totalSettled' => (float) $period->total_settled,
                'status' => $period->status,
            ],
        ], 201);
    }
}
