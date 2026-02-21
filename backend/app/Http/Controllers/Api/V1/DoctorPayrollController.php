<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollContract;
use App\Models\DoctorPayrollPeriod;
use App\Models\DoctorPayrollSettlement;
use App\Models\FinancialAuditLog;
use Carbon\Carbon;
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
            ->with('doctor:id,name')
            ->when($periodMonth, fn ($query) => $query->where('period_month', $periodMonth))
            ->when($doctorId, fn ($query) => $query->where('doctor_id', $doctorId))
            ->when($branchId, function ($query) use ($branchId): void {
                $query->whereHas('doctor.branches', fn ($doctorQuery) => $doctorQuery->where('branches.id', (int) $branchId));
            })
            ->orderByDesc('period_month')
            ->orderBy('doctor_id')
            ->get()
            ->groupBy(fn (DoctorEarningsLedger $entry) => $entry->doctor_id.'|'.$entry->period_month);

        $data = $rows->map(function ($entries): array {
            $first = $entries->first();
            $doctorId = (int) $first->doctor_id;
            $periodMonthKey = (string) $first->period_month;

            $totalEarned = (float) $entries
                ->filter(fn (DoctorEarningsLedger $entry) => in_array($entry->earning_type, ['COMMISSION', 'FIXED_SALARY_ACCRUAL', 'CLAWBACK'], true))
                ->sum('amount');

            $totalAdjustments = (float) $entries
                ->filter(fn (DoctorEarningsLedger $entry) => $entry->earning_type === 'ADJUSTMENT')
                ->sum('amount');

            $commissionDetails = [
                'consultationBasis' => 0.0,
                'consultationAmount' => 0.0,
                'consultationRate' => null,
                'servicesBasis' => 0.0,
                'servicesAmount' => 0.0,
                'servicesRate' => null,
            ];

            $entries
                ->filter(fn (DoctorEarningsLedger $entry) => $entry->earning_type === 'COMMISSION')
                ->each(function (DoctorEarningsLedger $entry) use (&$commissionDetails): void {
                    $notePayload = json_decode((string) $entry->notes, true);
                    if (! is_array($notePayload)) {
                        return;
                    }

                    $consultationBasis = (float) data_get($notePayload, 'consultation_basis', 0);
                    $consultationRate = (float) data_get($notePayload, 'consultation_rate', 0);
                    $servicesBasis = (float) data_get($notePayload, 'services_basis', 0);
                    $servicesRate = (float) data_get($notePayload, 'services_rate', 0);

                    $commissionDetails['consultationBasis'] += $consultationBasis;
                    $commissionDetails['servicesBasis'] += $servicesBasis;
                    $commissionDetails['consultationAmount'] += round($consultationBasis * ($consultationRate / 100), 2);
                    $commissionDetails['servicesAmount'] += round($servicesBasis * ($servicesRate / 100), 2);

                    if ($commissionDetails['consultationRate'] === null && $consultationRate > 0) {
                        $commissionDetails['consultationRate'] = $consultationRate;
                    }

                    if ($commissionDetails['servicesRate'] === null && $servicesRate > 0) {
                        $commissionDetails['servicesRate'] = $servicesRate;
                    }
                });

            $period = DoctorPayrollPeriod::query()->firstOrCreate(
                [
                    'doctor_id' => $doctorId,
                    'period_month' => $periodMonthKey,
                ],
                [
                    'total_earned' => 0,
                    'total_adjustments' => 0,
                    'total_settled' => 0,
                    'status' => 'OPEN',
                ]
            );

            $period->forceFill([
                'total_earned' => $totalEarned,
                'total_adjustments' => $totalAdjustments,
            ])->save();

            return [
                'periodId' => $period->id,
                'doctorId' => $doctorId,
                'doctorName' => $first->doctor?->name,
                'periodMonth' => $periodMonthKey,
                'totalEarned' => (float) $period->total_earned,
                'totalAdjustments' => (float) $period->total_adjustments,
                'totalSettled' => (float) $period->total_settled,
                'status' => $period->status,
                'closedAt' => optional($period->closed_at)?->toISOString(),
                'periodEnded' => $this->hasPeriodEnded($periodMonthKey),
                'canSettle' => $period->status !== 'SETTLED',
                'commissionDetails' => [
                    'consultationBasis' => round($commissionDetails['consultationBasis'], 2),
                    'consultationAmount' => round($commissionDetails['consultationAmount'], 2),
                    'consultationRate' => $commissionDetails['consultationRate'],
                    'servicesBasis' => round($commissionDetails['servicesBasis'], 2),
                    'servicesAmount' => round($commissionDetails['servicesAmount'], 2),
                    'servicesRate' => $commissionDetails['servicesRate'],
                ],
                'settlements' => $period->settlements()
                    ->orderByDesc('settlement_date')
                    ->orderByDesc('id')
                    ->get()
                    ->map(fn (DoctorPayrollSettlement $settlement): array => [
                        'id' => (string) $settlement->id,
                        'settlementDate' => optional($settlement->settlement_date)?->format('Y-m-d'),
                        'amount' => (float) $settlement->amount,
                        'settlementKind' => $settlement->settlement_kind,
                        'method' => $settlement->method,
                        'reference' => $settlement->reference,
                    ])
                    ->values(),
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
            ->whereIn('model', ['FIXED_SALARY', 'HYBRID'])
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

    public function close(Request $request, int $id): JsonResponse
    {
        $this->assertPermission($request, 'payroll.close', ['ADMIN', 'FINANCE_ADMIN', 'BRANCH_MANAGER']);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        /** @var DoctorPayrollPeriod $period */
        $period = DoctorPayrollPeriod::query()->findOrFail($id);

        if ($period->status === 'SETTLED') {
            return response()->json(['message' => 'Payroll period already settled.'], 422);
        }

        $before = $period->toArray();
        $period->status = 'CLOSED';
        $period->closed_at = now();
        $period->save();

        $this->writePayrollAuditLog(
            (int) auth()->user()->clinic_id,
            auth()->id(),
            'PAYROLL_PERIOD_CLOSED',
            $period,
            $before,
            $period->toArray(),
            $validated['reason'] ?? null
        );

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
        $this->assertPermission($request, 'payroll.settle', ['ADMIN', 'FINANCE_ADMIN', 'BRANCH_MANAGER']);

        $validated = $request->validate([
            'settlement_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['required', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:255'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        /** @var DoctorPayrollPeriod $period */
        $period = DoctorPayrollPeriod::query()->findOrFail($id);

        $targetAmount = (float) $period->total_earned + (float) $period->total_adjustments;
        $remainingAmount = max($targetAmount - (float) $period->total_settled, 0.0);

        if ((float) $validated['amount'] > $remainingAmount) {
            return response()->json(['message' => 'Settlement amount exceeds remaining doctor entitlement.'], 422);
        }

        DB::transaction(function () use ($period, $validated): void {
            $targetAmount = (float) $period->total_earned + (float) $period->total_adjustments;
            $remainingAmount = max($targetAmount - (float) $period->total_settled, 0.0);

            $settlement = DoctorPayrollSettlement::query()->create([
                'period_id' => $period->id,
                'settlement_date' => $validated['settlement_date'],
                'amount' => $validated['amount'],
                'settlement_kind' => (float) $validated['amount'] >= $remainingAmount ? 'FINAL' : 'PARTIAL',
                'method' => strtoupper((string) $validated['method']),
                'reference' => $validated['reference'] ?? null,
                'created_by' => auth()->id(),
            ]);

            $this->writePayrollAuditLog(
                (int) $period->clinic_id,
                auth()->id(),
                'PAYROLL_SETTLEMENT_CREATED',
                $settlement,
                null,
                $settlement->toArray(),
                $validated['reason'] ?? null
            );

            $period->refresh();
            $period->total_settled = (float) DoctorPayrollSettlement::query()
                ->where('period_id', $period->id)
                ->sum('amount');

            $targetAmount = (float) $period->total_earned + (float) $period->total_adjustments;

            if ($period->status === 'CLOSED' && $period->total_settled >= $targetAmount && $targetAmount > 0) {
                $period->status = 'SETTLED';
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


    private function writePayrollAuditLog(
        int $clinicId,
        ?int $actorId,
        string $actionType,
        object $target,
        ?array $beforeSnapshot,
        ?array $afterSnapshot,
        ?string $reason
    ): void {
        FinancialAuditLog::query()->create([
            'clinic_id' => $clinicId,
            'invoice_id' => null,
            'actor_id' => $actorId,
            'action_type' => $actionType,
            'target_entity_type' => class_basename($target),
            'target_entity_id' => (string) ($target->id ?? ''),
            'before_snapshot' => $beforeSnapshot,
            'after_snapshot' => $afterSnapshot,
            'reason' => $reason,
            'occurred_at' => now(),
        ]);
    }

    private function hasPeriodEnded(string $periodMonth): bool
    {
        $monthEnd = Carbon::createFromFormat('Y-m-d', $periodMonth.'-01')
            ->endOfMonth()
            ->endOfDay();

        return now()->greaterThanOrEqualTo($monthEnd);
    }

    private function assertPermission(Request $request, string $permission, array $fallbackRoles): void
    {
        $user = $request->user();

        $hasPermission = $user->hasPermissionTo($permission, 'web')
            || DB::table('roles')
                ->join('role_has_permissions', 'role_has_permissions.role_id', '=', 'roles.id')
                ->join('permissions', 'permissions.id', '=', 'role_has_permissions.permission_id')
                ->where('roles.clinic_id', (int) $user->clinic_id)
                ->where('roles.name', (string) $user->role)
                ->where('permissions.name', $permission)
                ->exists()
            || in_array((string) $user->role, $fallbackRoles, true);

        abort_unless($hasPermission, 403, 'You are not allowed to perform this payroll action.');
    }
}
