<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AppointmentRequest;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $appointments = Appointment::query()
            ->select(['id', 'clinic_id', 'patient_id', 'doctor_id', 'branch_id', 'date', 'time_slot', 'status'])
            ->with(['invoice:id,appointment_id,total,paid_amount,status'])
            ->when($request->filled('branchId'), fn ($query) => $query->where('branch_id', $request->integer('branchId')))
            ->when($request->filled('doctorId'), fn ($query) => $query->where('doctor_id', $request->integer('doctorId')))
            ->when($request->filled('date'), fn ($query) => $query->whereDate('date', $request->string('date')->value()))
            ->latest('date')
            ->simplePaginate(20);

        return AppointmentResource::collection($appointments);
    }

    public function availableSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        $doctor = User::query()
            ->where('role', 'DOCTOR')
            ->whereKey($validated['doctorId'])
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        if (! $doctor) {
            return response()->json(['message' => 'Doctor not available in this branch.'], 422);
        }

        $slots = collect($doctor->schedule ?? [])
            ->filter(function (array $shift) use ($validated): bool {
                return (string) ($shift['branchId'] ?? '') === (string) $validated['branchId']
                    && (int) ($shift['dayOfWeek'] ?? -1) === Carbon::parse($validated['date'])->dayOfWeek;
            })
            ->flatMap(function (array $shift): array {
                $duration = max(5, (int) ($shift['slotDuration'] ?? 20));
                $cursor = Carbon::createFromFormat('H:i', (string) ($shift['startTime'] ?? '09:00'));
                $end = Carbon::createFromFormat('H:i', (string) ($shift['endTime'] ?? '17:00'));

                $result = [];
                while ($cursor->lt($end)) {
                    $result[] = $cursor->format('H:i');
                    $cursor->addMinutes($duration);
                }

                return $result;
            })
            ->unique()
            ->sort()
            ->values();

        $bookedSlots = Appointment::query()
            ->where('doctor_id', $validated['doctorId'])
            ->where('branch_id', $validated['branchId'])
            ->whereDate('date', $validated['date'])
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->pluck('time_slot')
            ->all();

        $response = $slots->map(fn (string $time) => [
            'time' => $time,
            'available' => ! in_array($time, $bookedSlots, true),
        ])->values();

        return response()->json(['data' => $response]);
    }

    public function store(AppointmentRequest $request): JsonResponse
    {
        $doctorBranchValid = User::query()
            ->whereKey($request->integer('doctorId'))
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $request->integer('branchId')))
            ->exists();

        abort_unless($doctorBranchValid, 422, 'Doctor is not assigned to the selected branch.');

        $alreadyBooked = Appointment::query()
            ->where('doctor_id', $request->integer('doctorId'))
            ->where('branch_id', $request->integer('branchId'))
            ->whereDate('date', $request->string('date')->value())
            ->where('time_slot', $request->string('timeSlot')->value())
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->exists();

        abort_if($alreadyBooked, 422, 'The selected slot is no longer available.');

        $appointment = DB::transaction(function () use ($request): Appointment {
            $appointment = Appointment::create([
                'clinic_id' => $request->user()->clinic_id,
                'patient_id' => $request->integer('patientId'),
                'doctor_id' => $request->integer('doctorId'),
                'branch_id' => $request->integer('branchId'),
                'date' => $request->string('date')->value(),
                'time_slot' => $request->string('timeSlot')->value(),
                'status' => $request->string('status')->value() ?: 'SCHEDULED',
            ]);

            Invoice::create([
                'clinic_id' => $request->user()->clinic_id,
                'appointment_id' => $appointment->id,
                'total' => $request->input('billing.total'),
                'paid_amount' => $request->input('billing.paidAmount'),
                'status' => $request->input('billing.status'),
            ]);

            return $appointment->load('invoice');
        });

        return response()->json(new AppointmentResource($appointment), 201);
    }
}
