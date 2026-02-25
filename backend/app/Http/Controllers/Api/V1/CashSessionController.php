<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CashSession;
use App\Models\ReconciliationSummary;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use App\Support\Authorization\ClinicBranchAuthorization;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashSessionController extends Controller
{
    public function __construct(private readonly ClinicBranchAuthorization $authorization)
    {
    }
    public function open(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
        ]);

        $clinicId = (int) $request->user()->clinic_id;
        $branchId = (int) $validated['branch_id'];

        $hasActiveSession = CashSession::query()
            ->where('clinic_id', $clinicId)
            ->where('branch_id', $branchId)
            ->where('status', 'OPEN')
            ->exists();

        abort_if($hasActiveSession, 422, 'An active cash session already exists for this branch.');

        $session = CashSession::query()->create([
            'clinic_id' => $clinicId,
            'branch_id' => $branchId,
            'opened_by' => $request->user()->id,
            'opening_balance' => (float) ($validated['opening_balance'] ?? 0),
            'expected_cash' => (float) ($validated['opening_balance'] ?? 0),
            'opened_at' => now(),
            'status' => 'OPEN',
        ]);

        return response()->json(['data' => $this->serializeSession($session)], 201);
    }

    public function active(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'integer'],
        ]);

        $clinicId = (int) $request->user()->clinic_id;
        $branchId = (int) $validated['branch_id'];

        $session = CashSession::query()
            ->where('clinic_id', $clinicId)
            ->where('branch_id', $branchId)
            ->where('status', 'OPEN')
            ->first();

        if (!$session) {
            return response()->json(['data' => null]);
        }

        $expectedFromTransactions = (float) Transaction::query()
            ->where('cash_session_id', $session->id)
            ->sum('amount');

        $session->expected_cash = (float) $session->opening_balance + $expectedFromTransactions;

        return response()->json(['data' => $this->serializeSession($session)]);
    }

    public function close(Request $request, CashSession $cashSession): JsonResponse
    {
        $this->authorization->assertTenantOwnership($request->user(), $cashSession);

        $validated = $request->validate([
            'collected_cash' => ['required', 'numeric', 'min:0'],
        ]);

        abort_if($cashSession->status !== 'OPEN', 422, 'Cash session is already closed.');

        $closed = DB::transaction(function () use ($request, $cashSession, $validated): CashSession {
            $expectedFromTransactions = (float) Transaction::query()
                ->where('cash_session_id', $cashSession->id)
                ->sum('amount');

            $expectedCash = (float) $cashSession->opening_balance + $expectedFromTransactions;
            $collectedCash = (float) $validated['collected_cash'];
            $variance = $collectedCash - $expectedCash;

            $cashSession->forceFill([
                'expected_cash' => $expectedCash,
                'collected_cash' => $collectedCash,
                'variance' => $variance,
                'closed_by' => $request->user()->id,
                'closed_at' => now(),
                'status' => 'CLOSED',
            ])->save();

            ReconciliationSummary::query()->create([
                'clinic_id' => $cashSession->clinic_id,
                'branch_id' => $cashSession->branch_id,
                'cash_session_id' => $cashSession->id,
                'closed_by' => $request->user()->id,
                'reconciliation_date' => now()->toDateString(),
                'opening_balance' => (float) $cashSession->opening_balance,
                'expected_cash' => $expectedCash,
                'collected_cash' => $collectedCash,
                'variance' => $variance,
            ]);

            return $cashSession->fresh();
        });

        return response()->json(['data' => $this->serializeSession($closed)]);
    }

    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['nullable', 'integer'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $clinicId = (int) $request->user()->clinic_id;
        $date = $validated['date'] ?? now()->toDateString();

        $rows = ReconciliationSummary::query()
            ->with('branch:id,name')
            ->where('clinic_id', $clinicId)
            ->whereDate('reconciliation_date', $date)
            ->when(isset($validated['branch_id']), fn ($query) => $query->where('branch_id', (int) $validated['branch_id']))
            ->orderBy('branch_id')
            ->get()
            ->map(fn (ReconciliationSummary $summary) => [
                'id' => (string) $summary->id,
                'cashSessionId' => (string) $summary->cash_session_id,
                'branchId' => (string) $summary->branch_id,
                'branchName' => $summary->branch?->name ?? 'Unknown Branch',
                'date' => $summary->reconciliation_date?->toDateString(),
                'openingBalance' => (float) $summary->opening_balance,
                'expectedCash' => (float) $summary->expected_cash,
                'collectedCash' => (float) $summary->collected_cash,
                'variance' => (float) $summary->variance,
                'closedBy' => $summary->closed_by ? (string) $summary->closed_by : null,
            ])
            ->values();

        return response()->json(['data' => $rows]);
    }

    private function serializeSession(CashSession $cashSession): array
    {
        return [
            'id' => (string) $cashSession->id,
            'branchId' => (string) $cashSession->branch_id,
            'openingBalance' => (float) $cashSession->opening_balance,
            'expectedCash' => (float) $cashSession->expected_cash,
            'collectedCash' => $cashSession->collected_cash !== null ? (float) $cashSession->collected_cash : null,
            'variance' => $cashSession->variance !== null ? (float) $cashSession->variance : null,
            'status' => (string) $cashSession->status,
            'openedAt' => optional($cashSession->opened_at)->toISOString(),
            'closedAt' => optional($cashSession->closed_at)->toISOString(),
            'closedBy' => $cashSession->closed_by ? (string) $cashSession->closed_by : null,
        ];
    }
}
