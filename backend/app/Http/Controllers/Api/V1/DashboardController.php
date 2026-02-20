<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $clinicId = $request->user()->clinic_id;
        $branchId  = $request->integer('branchId') ?: null;

        return response()->json([
            'revenue'        => $this->weeklyRevenue($clinicId, $branchId),
            'visits_by_dept' => $this->visitsByDepartment($clinicId, $branchId),
        ]);
    }

    // ---------- helpers ----------

    private function weeklyRevenue(int $clinicId, ?int $branchId): array
    {
        $days = collect();
        for ($i = 6; $i >= 0; $i--) {
            $days->push(Carbon::today()->subDays($i));
        }

        // sum paid_amount per day from invoices joined with appointments
        $rows = DB::table('invoices')
            ->join('appointments', 'appointments.id', '=', 'invoices.appointment_id')
            ->select(
                DB::raw('DATE(appointments.date) as day'),
                DB::raw('SUM(invoices.paid_amount) as revenue')
            )
            ->where('appointments.clinic_id', $clinicId)
            ->when($branchId, fn ($q) => $q->where('appointments.branch_id', $branchId))
            ->whereBetween('appointments.date', [
                Carbon::today()->subDays(6)->startOfDay(),
                Carbon::today()->endOfDay(),
            ])
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        return $days->map(function (Carbon $date) use ($rows) {
            $key     = $date->format('Y-m-d');
            $revenue = isset($rows[$key]) ? (float) $rows[$key]->revenue : 0.0;

            return [
                'date'    => $date->format('D'),   // Mon, Tue …
                'revenue' => $revenue,
            ];
        })->values()->all();
    }

    private function visitsByDepartment(int $clinicId, ?int $branchId): array
    {
        return DB::table('appointments')
            ->join('users', 'users.id', '=', 'appointments.doctor_id')
            ->select(
                DB::raw("COALESCE(NULLIF(users.specialty,''), 'Other') as name"),
                DB::raw('COUNT(appointments.id) as count')
            )
            ->where('appointments.clinic_id', $clinicId)
            ->when($branchId, fn ($q) => $q->where('appointments.branch_id', $branchId))
            ->whereNotIn('appointments.status', ['CANCELLED', 'NO_SHOW'])
            ->groupBy('name')
            ->orderByDesc('count')
            ->limit(6)
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->count])
            ->values()
            ->all();
    }
}
