<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinancialReportController extends Controller
{
    public function index(Request $request)
    {
        $filters = $this->resolveFilters($request);
        $report = $this->buildReportPayload($filters);

        return response()->json(['data' => $report]);
    }

    public function export(Request $request): StreamedResponse
    {
        $format = strtolower((string) $request->query('format', 'csv'));
        if ($format !== 'csv') {
            abort(422, 'Unsupported export format.');
        }

        $filters = $this->resolveFilters($request);
        $report = $this->buildReportPayload($filters);
        $filename = $this->buildExportFilename($filters, 'csv');

        return response()->streamDownload(function () use ($report): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, ['Financial Report Export']);
            fputcsv($handle, ['Generated At', now()->toDateTimeString()]);
            fputcsv($handle, []);

            fputcsv($handle, ['Summary']);
            fputcsv($handle, ['Total Revenue', $report['summary']['totalRevenue']]);
            fputcsv($handle, ['Cash Collected', $report['summary']['cashCollected']]);
            fputcsv($handle, ['Outstanding Revenue', $report['summary']['outstandingRevenue']]);
            fputcsv($handle, ['Average Ticket', $report['summary']['averageTicket']]);
            fputcsv($handle, []);

            fputcsv($handle, ['Doctor Revenue']);
            fputcsv($handle, ['Doctor Name', 'Amount']);
            foreach ($report['doctorRevenue'] as $row) {
                fputcsv($handle, [$row['doctorName'], $row['amount']]);
            }
            fputcsv($handle, []);

            fputcsv($handle, ['Branch Revenue']);
            fputcsv($handle, ['Branch ID', 'Branch Name', 'Amount']);
            foreach ($report['branchRevenue'] as $row) {
                fputcsv($handle, [$row['branchId'], $row['branchName'], $row['amount']]);
            }
            fputcsv($handle, []);

            fputcsv($handle, ['Recent Transactions']);
            fputcsv($handle, ['Reference', 'Patient Name', 'Date', 'Method', 'Amount']);
            foreach ($report['recentTransactions'] as $row) {
                fputcsv($handle, [$row['reference'], $row['patientName'], $row['date'], $row['method'], $row['amount']]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function resolveFilters(Request $request): array
    {
        return [
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'branchId' => $request->query('branch_id'),
        ];
    }

    private function buildReportPayload(array $filters): array
    {
        // Revenue-bearing appointments: exclude NO_SHOW (patient didn't come, money wasn't earned)
        $attendedAppointments = $this->appointmentsQuery($filters)
            ->where('status', '!=', 'NO_SHOW')
            ->get();

        // No-show appointments: tracked separately for reporting
        $noShowAppointments = $this->appointmentsQuery($filters)
            ->where('status', 'NO_SHOW')
            ->get();

        $totalRevenue = (float) $attendedAppointments->sum(fn (Appointment $appointment) => $appointment->invoice?->total ?? 0);
        $paidRevenue = (float) $attendedAppointments->sum(fn (Appointment $appointment) => $appointment->invoice?->paid_amount ?? 0);
        $outstandingRevenue = max($totalRevenue - $paidRevenue, 0);
        $noShowRevenue = (float) $noShowAppointments->sum(fn (Appointment $appointment) => $appointment->invoice?->total ?? 0);

        $doctorRevenue = $attendedAppointments
            ->groupBy(fn (Appointment $appointment) => $appointment->doctor?->name ?? 'Unknown Doctor')
            ->map(fn (Collection $group, string $doctorName) => [
                'doctorName' => $doctorName,
                'amount' => (float) $group->sum(fn (Appointment $appointment) => $appointment->invoice?->total ?? 0),
            ])
            ->sortByDesc('amount')
            ->values()
            ->all();

        $branchRevenue = $attendedAppointments
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
            ->values()
            ->all();

        $transactions = $this->transactionsQuery($filters)
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
            ])
            ->values()
            ->all();

        $cashCollected = (float) $this->transactionsQuery($filters)
            ->whereRaw('UPPER(COALESCE(method, ?)) = ?', ['CASH', 'CASH'])
            ->sum('amount');

        return [
            'summary' => [
                'totalRevenue' => $totalRevenue,
                'cashCollected' => $cashCollected,
                'outstandingRevenue' => $outstandingRevenue,
                'averageTicket' => $attendedAppointments->count() > 0 ? round($totalRevenue / $attendedAppointments->count(), 2) : 0,
                'noShowRevenue' => $noShowRevenue,         // Money lost to no-shows (informational only)
                'noShowCount' => $noShowAppointments->count(),
            ],
            'doctorRevenue' => $doctorRevenue,
            'branchRevenue' => $branchRevenue,
            'recentTransactions' => $transactions,
        ];
    }

    private function appointmentsQuery(array $filters): Builder
    {
        return Appointment::query()
            ->with(['doctor:id,name', 'branch:id,name', 'patient:id,name', 'invoice:id,appointment_id,total,paid_amount,status'])
            ->whereHas('invoice')
            ->when($filters['branchId'], fn ($query) => $query->where('branch_id', (int) $filters['branchId']))
            ->when($filters['from'], fn ($query) => $query->whereDate('date', '>=', $filters['from']))
            ->when($filters['to'], fn ($query) => $query->whereDate('date', '<=', $filters['to']));
    }

    private function transactionsQuery(array $filters): Builder
    {
        return Transaction::query()
            ->select(['id', 'invoice_id', 'amount', 'method', 'paid_at'])
            ->with(['invoice.appointment.patient:id,name'])
            ->when($filters['branchId'], fn ($query) => $query->whereHas('invoice.appointment', fn ($appointmentQuery) => $appointmentQuery->where('branch_id', (int) $filters['branchId'])))
            ->when($filters['from'], fn ($query) => $query->whereDate('paid_at', '>=', $filters['from']))
            ->when($filters['to'], fn ($query) => $query->whereDate('paid_at', '<=', $filters['to']));
    }

    private function buildExportFilename(array $filters, string $extension): string
    {
        $branchSegment = $filters['branchId'] ? 'branch-'.$filters['branchId'] : 'all-branches';
        $dateSegment = ($filters['from'] ?: 'start').'_to_'.($filters['to'] ?: 'today');

        return "financial-report_{$branchSegment}_{$dateSegment}.{$extension}";
    }
}
