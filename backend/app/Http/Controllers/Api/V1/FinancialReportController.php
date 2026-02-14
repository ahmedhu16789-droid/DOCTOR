<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class FinancialReportController extends Controller
{
    public function index(Request $request)
    {
        $from = $request->query('from');
        $to = $request->query('to');

        $appointmentsQuery = Appointment::query()
            ->with(['doctor:id,name', 'branch:id,name', 'patient:id,name', 'invoice:id,appointment_id,total,paid_amount,status'])
            ->whereHas('invoice')
            ->when($from, fn ($query) => $query->whereDate('date', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('date', '<=', $to));

        $appointments = $appointmentsQuery->get();

        $totalRevenue = (float) $appointments->sum(fn (Appointment $appointment) => $appointment->invoice?->total ?? 0);
        $paidRevenue = (float) $appointments->sum(fn (Appointment $appointment) => $appointment->invoice?->paid_amount ?? 0);
        $outstandingRevenue = max($totalRevenue - $paidRevenue, 0);

        $doctorRevenue = $appointments
            ->groupBy(fn (Appointment $appointment) => $appointment->doctor?->name ?? 'Unknown Doctor')
            ->map(fn (Collection $group, string $doctorName) => [
                'doctorName' => $doctorName,
                'amount' => (float) $group->sum(fn (Appointment $appointment) => $appointment->invoice?->total ?? 0),
            ])
            ->sortByDesc('amount')
            ->values();

        $branchRevenue = $appointments
            ->groupBy(fn (Appointment $appointment) => (string) $appointment->branch_id)
            ->map(function (Collection $group, string $branchId): array {
                $first = $group->first();

                return [
                    'branchId' => $branchId,
                    'branchName' => $first?->branch?->name ?? "Branch {$branchId}",
                    'amount' => (float) $group->sum(fn (Appointment $appointment) => $appointment->invoice?->total ?? 0),
                ];
            })
            ->sortByDesc('amount')
            ->values();

        $transactions = Transaction::query()
            ->select(['id', 'invoice_id', 'amount', 'method', 'paid_at'])
            ->with(['invoice.appointment.patient:id,name'])
            ->when($from, fn ($query) => $query->whereDate('paid_at', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('paid_at', '<=', $to))
            ->latest('paid_at')
            ->limit(25)
            ->get()
            ->map(fn (Transaction $transaction) => [
                'id' => (string) $transaction->id,
                'reference' => 'TX-' . str_pad((string) $transaction->id, 6, '0', STR_PAD_LEFT),
                'patientName' => $transaction->invoice?->appointment?->patient?->name ?? 'Unknown Patient',
                'date' => optional($transaction->paid_at)->toDateString(),
                'method' => strtoupper((string) ($transaction->method ?? 'CASH')),
                'amount' => (float) $transaction->amount,
            ]);

        $cashCollected = (float) Transaction::query()
            ->when($from, fn ($query) => $query->whereDate('paid_at', '>=', $from))
            ->when($to, fn ($query) => $query->whereDate('paid_at', '<=', $to))
            ->whereRaw('UPPER(COALESCE(method, ?)) = ?', ['CASH', 'CASH'])
            ->sum('amount');

        return response()->json([
            'data' => [
                'summary' => [
                    'totalRevenue' => $totalRevenue,
                    'cashCollected' => $cashCollected,
                    'outstandingRevenue' => $outstandingRevenue,
                    'averageTicket' => $appointments->count() > 0 ? round($totalRevenue / $appointments->count(), 2) : 0,
                ],
                'doctorRevenue' => $doctorRevenue,
                'branchRevenue' => $branchRevenue,
                'recentTransactions' => $transactions,
            ],
        ]);
    }
}
