<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DoctorEarningsLedger;
use App\Models\DoctorPayrollPeriod;
use App\Models\DoctorPayrollSettlement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DoctorPayrollController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $periodMonth = $request->query('period_month');
        $doctorId = $request->query('doctor_id');

        $rows = DoctorEarningsLedger::query()
            ->selectRaw('doctor_id, period_month, SUM(amount) as total_earned, SUM(CASE WHEN earning_type = ? THEN amount ELSE 0 END) as total_adjustments', ['ADJUSTMENT'])
            ->with('doctor:id,name')
            ->when($periodMonth, fn ($query) => $query->where('period_month', $periodMonth))
            ->when($doctorId, fn ($query) => $query->where('doctor_id', $doctorId))
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

        return response()->json(['data' => $data]);
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
