<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AppointmentRequest;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use App\Support\ApiCache;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $authenticatedUser = $request->user();
        $isDoctor = $authenticatedUser?->role === 'DOCTOR';

        $filters = [
            'branchId' => $request->integer('branchId'),
            'doctorId' => $isDoctor ? $authenticatedUser?->id : $request->integer('doctorId'),
            'date' => $request->string('date')->value(),
            'page' => max(1, $request->integer('page', 1)),
        ];

        $appointments = ApiCache::remember(
            'appointments.index',
            $request->user()?->clinic_id,
            md5(json_encode($filters)),
            fn () => Appointment::query()
                ->select(['id', 'clinic_id', 'patient_id', 'doctor_id', 'branch_id', 'date', 'time_slot', 'status'])
                ->with(['invoice:id,appointment_id,total,paid_amount,status', 'invoice.items:id,invoice_id,service_id,name,quantity,unit_price,total', 'encounter:id,appointment_id,status'])
                ->when($request->filled('branchId'), fn ($query) => $query->where('branch_id', $request->integer('branchId')))
                ->when($filters['doctorId'], fn ($query) => $query->where('doctor_id', $filters['doctorId']))
                ->when($request->filled('date'), fn ($query) => $query->whereDate('date', $request->string('date')->value()))
                ->latest('date')
                ->simplePaginate(50, ['*'], 'page', $filters['page'])
        );

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
            ->select(['id', 'schedule'])
            ->where('role', 'DOCTOR')
            ->whereKey($validated['doctorId'])
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        if (! $doctor) {
            return response()->json(['message' => 'Doctor not available in this branch.'], 422);
        }

        $slots = $this->generateSlotsForDoctor($doctor, $validated['branchId'], $validated['date']);
        $bookedSlots = $this->loadBookedSlots([$validated['doctorId']], $validated['branchId'], $validated['date']);

        return response()->json([
            'data' => $slots->map(fn (string $time) => [
                'time' => $time,
                'available' => ! in_array($time, $bookedSlots[$validated['doctorId']] ?? [], true),
            ])->values(),
        ]);
    }

    public function availableSlotsBulk(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'doctorIds' => ['required', 'array', 'min:1', 'max:30'],
            'doctorIds.*' => ['integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        $doctorIds = collect($validated['doctorIds'])->map(fn ($id) => (int) $id)->values();

        $doctors = User::query()
            ->select(['id', 'schedule'])
            ->where('role', 'DOCTOR')
            ->whereIn('id', $doctorIds)
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->get();

        $bookedSlots = $this->loadBookedSlots($doctors->pluck('id')->all(), $validated['branchId'], $validated['date']);

        $data = $doctors->mapWithKeys(function (User $doctor) use ($validated, $bookedSlots): array {
            $slots = $this->generateSlotsForDoctor($doctor, $validated['branchId'], $validated['date']);

            return [
                (string) $doctor->id => $slots->map(fn (string $time) => [
                    'time' => $time,
                    'available' => ! in_array($time, $bookedSlots[$doctor->id] ?? [], true),
                ])->values()->all(),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function store(AppointmentRequest $request): JsonResponse
    {
        $doctorId = $request->integer('doctorId');
        $branchId = $request->integer('branchId');
        $date = $request->string('date')->value();
        $timeSlot = $request->string('timeSlot')->value();

        $doctor = User::query()
            ->select(['id', 'schedule'])
            ->whereKey($doctorId)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $branchId))
            ->first();

        abort_if(! $doctor, 422, 'Doctor is not assigned to the selected branch.');

        $validSlot = $this->generateSlotsForDoctor($doctor, $branchId, $date)->contains($timeSlot);
        abort_if(! $validSlot, 422, 'The selected slot is outside the doctor schedule.');

        $alreadyBooked = Appointment::query()
            ->where('doctor_id', $doctorId)
            ->where('branch_id', $branchId)
            ->whereDate('date', $date)
            ->where('time_slot', $timeSlot)
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->exists();

        abort_if($alreadyBooked, 422, 'The selected slot is no longer available.');

        $appointment = DB::transaction(function () use ($request, $doctorId, $branchId, $date, $timeSlot): Appointment {
            $appointment = Appointment::create([
                'clinic_id' => $request->user()->clinic_id,
                'patient_id' => $request->integer('patientId'),
                'doctor_id' => $doctorId,
                'branch_id' => $branchId,
                'date' => $date,
                'time_slot' => $timeSlot,
                'status' => $request->string('status')->value() ?: 'SCHEDULED',
            ]);

            $invoice = Invoice::create([
                'clinic_id' => $request->user()->clinic_id,
                'appointment_id' => $appointment->id,
                'total' => $request->input('billing.total'),
                'paid_amount' => $request->input('billing.paidAmount'),
                'status' => $request->input('billing.status'),
            ]);

            InvoiceItem::query()->create([
                'clinic_id' => $request->user()->clinic_id,
                'invoice_id' => $invoice->id,
                'service_id' => 'srv_cns',
                'name' => 'Consultation Fee',
                'category' => 'CONSULTATION',
                'quantity' => 1,
                'unit_price' => (float) $request->input('billing.total', 0),
                'total' => (float) $request->input('billing.total', 0),
                'added_by' => $request->user()->id,
            ]);

            return $appointment->load('invoice.items');
        });

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(new AppointmentResource($appointment), 201);
    }

    private function generateSlotsForDoctor(User $doctor, int $branchId, string $date): Collection
    {
        $dayOfWeek = Carbon::parse($date)->dayOfWeek;

        return collect($doctor->schedule ?? [])
            ->filter(function (array $shift) use ($branchId, $dayOfWeek): bool {
                return (string) ($shift['branchId'] ?? '') === (string) $branchId
                    && (int) ($shift['dayOfWeek'] ?? -1) === $dayOfWeek;
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
    }

    private function loadBookedSlots(array $doctorIds, int $branchId, string $date): array
    {
        if (empty($doctorIds)) {
            return [];
        }

        return Appointment::query()
            ->select(['doctor_id', 'time_slot'])
            ->whereIn('doctor_id', $doctorIds)
            ->where('branch_id', $branchId)
            ->whereDate('date', $date)
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->get()
            ->groupBy('doctor_id')
            ->map(fn (Collection $group) => $group->pluck('time_slot')->all())
            ->all();
    }
}
