<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AppointmentRequest;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\AppointmentSlotShift;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use App\Services\Booking\DoctorScheduleService;
use App\Support\ApiCache;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppointmentController extends Controller
{
    public function __construct(private readonly DoctorScheduleService $scheduleService)
    {
    }

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

        // $appointments = ApiCache::remember(
        //     'appointments.index',
        //     $request->user()?->clinic_id,
        //     md5(json_encode($filters)),
        //     fn () => Appointment::query()
        $appointments = Appointment::query()
                ->select(['id', 'clinic_id', 'patient_id', 'doctor_id', 'branch_id', 'date', 'time_slot', 'status'])
                ->with(['doctor:id,name,specialty', 'invoice:id,appointment_id,total,paid_amount,status', 'invoice.items:id,invoice_id,service_id,name,quantity,unit_price,total', 'encounter:id,appointment_id,status'])
                ->when($request->filled('branchId'), fn ($query) => $query->where('branch_id', $request->integer('branchId')))
                ->when($filters['doctorId'], fn ($query) => $query->where('doctor_id', $filters['doctorId']))
                ->when($request->filled('date'), fn ($query) => $query->whereDate('date', $request->string('date')->value()))
                ->latest('date')
                ->simplePaginate(50, ['*'], 'page', $filters['page']);
        // );

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
            ->select(['id', 'clinic_id', 'schedule'])
            ->where('role', 'DOCTOR')
            ->whereKey($validated['doctorId'])
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        if (! $doctor) {
            return response()->json(['message' => 'Doctor not available in this branch.'], 422);
        }

        $slots = $this->scheduleService->generateSlotsForDoctor($doctor, $validated['branchId'], $validated['date']);
        $bookedSlots = $this->scheduleService->loadBookedSlots([$validated['doctorId']], $validated['branchId'], $validated['date']);

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
            ->select(['id', 'clinic_id', 'schedule'])
            ->where('role', 'DOCTOR')
            ->whereIn('id', $doctorIds)
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->get();

        $bookedSlots = $this->scheduleService->loadBookedSlots($doctors->pluck('id')->all(), $validated['branchId'], $validated['date']);

        $data = $doctors->mapWithKeys(function (User $doctor) use ($validated, $bookedSlots): array {
            $slots = $this->scheduleService->generateSlotsForDoctor($doctor, $validated['branchId'], $validated['date']);

            return [
                (string) $doctor->id => $slots->map(fn (string $time) => [
                    'time' => $time,
                    'available' => ! in_array($time, $bookedSlots[$doctor->id] ?? [], true),
                ])->values()->all(),
            ];
        });

        return response()->json(['data' => $data]);
    }

    public function bulkShift(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'fromTime' => ['required', 'date_format:H:i'],
            'shiftMinutes' => ['required', 'integer', 'min:1', 'max:720'],
        ]);

        $allowedRoles = ['ADMIN', 'DOCTOR', 'RECEPTIONIST'];
        abort_unless(in_array((string) $request->user()->role, $allowedRoles, true), 403);

        if ($request->user()->role === 'DOCTOR') {
            abort_if((int) $request->user()->id !== (int) $validated['doctorId'], 403, 'Doctors can only shift their own appointments.');
        }

        $clinicId = $request->user()->clinic_id;

        $doctor = User::query()
            ->select(['id'])
            ->whereKey($validated['doctorId'])
            ->where('clinic_id', $clinicId)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        abort_if(! $doctor, 422, 'Doctor is not assigned to the selected branch.');

        $shiftedCount = DB::transaction(function () use ($clinicId, $validated): int {
            $appointments = Appointment::query()
                ->where('clinic_id', $clinicId)
                ->where('doctor_id', $validated['doctorId'])
                ->where('branch_id', $validated['branchId'])
                ->whereDate('date', $validated['date'])
                ->where('time_slot', '>=', $validated['fromTime'])
                ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
                ->orderBy('time_slot')
                ->lockForUpdate()
                ->get();

            foreach ($appointments as $appointment) {
                $appointment->update([
                    'time_slot' => Carbon::createFromFormat('H:i', $appointment->time_slot)
                        ->addMinutes($validated['shiftMinutes'])
                        ->format('H:i'),
                ]);
            }

            AppointmentSlotShift::query()->create([
                'clinic_id' => $clinicId,
                'doctor_id' => $validated['doctorId'],
                'branch_id' => $validated['branchId'],
                'date' => $validated['date'],
                'from_time' => $validated['fromTime'],
                'shift_minutes' => $validated['shiftMinutes'],
            ]);

            return $appointments->count();
        });

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json([
            'data' => [
                'shiftedAppointments' => $shiftedCount,
                'doctorId' => (string) $validated['doctorId'],
                'branchId' => (string) $validated['branchId'],
                'date' => $validated['date'],
                'fromTime' => $validated['fromTime'],
                'shiftMinutes' => $validated['shiftMinutes'],
            ],
        ]);
    }

    public function reschedule(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'doctorId' => ['nullable', 'integer', 'exists:users,id'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'timeSlot' => ['required', 'date_format:H:i'],
        ]);

        $doctorId = (int) ($validated['doctorId'] ?? $appointment->doctor_id);
        $branchId = (int) ($validated['branchId'] ?? $appointment->branch_id);

        $doctor = User::query()
            ->select(['id', 'clinic_id', 'schedule'])
            ->whereKey($doctorId)
            ->where('clinic_id', $request->user()->clinic_id)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $branchId))
            ->first();

        abort_if(! $doctor, 422, 'Doctor is not assigned to the selected branch.');

        $validSlot = $this->scheduleService->generateSlotsForDoctor($doctor, $branchId, $validated['date'])->contains($validated['timeSlot']);
        abort_if(! $validSlot, 422, 'The selected slot is outside the doctor schedule.');

        $alreadyBooked = Appointment::query()
            ->where('clinic_id', $request->user()->clinic_id)
            ->where('doctor_id', $doctorId)
            ->where('branch_id', $branchId)
            ->whereDate('date', $validated['date'])
            ->where('time_slot', $validated['timeSlot'])
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->whereKeyNot($appointment->id)
            ->exists();

        abort_if($alreadyBooked, 422, 'The selected slot is no longer available.');

        $appointment->update([
            'doctor_id' => $doctorId,
            'branch_id' => $branchId,
            'date' => $validated['date'],
            'time_slot' => $validated['timeSlot'],
            'status' => 'SCHEDULED',
        ]);

        $appointment->load(['doctor:id,name,specialty', 'invoice.items', 'encounter:id,appointment_id,status']);

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function updateStatus(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'status' => ['required', 'in:SCHEDULED,WAITING,CALLED,IN_PROGRESS,COMPLETED,NO_SHOW'],
        ]);

        $status = $validated['status'];

        $appointment->status = $status;

        if ($status === 'CALLED' && ! $appointment->called_at) {
            $appointment->called_at = now();
        }

        if ($status === 'IN_PROGRESS') {
            $appointment->started_at = $appointment->started_at ?? now();
            $appointment->called_at = $appointment->called_at ?? now();
        }

        if ($status === 'COMPLETED') {
            $appointment->completed_at = now();
            $appointment->started_at = $appointment->started_at ?? now();
            $appointment->called_at = $appointment->called_at ?? $appointment->started_at;
        }

        if ($status === 'NO_SHOW') {
            $appointment->no_show_at = now();
        }

        $appointment->save();
        $appointment->load(['doctor:id,name,specialty', 'invoice.items', 'encounter:id,appointment_id,status']);

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function store(AppointmentRequest $request): JsonResponse
    {
        $doctorId = $request->integer('doctorId');
        $branchId = $request->integer('branchId');
        $date = $request->string('date')->value();
        $timeSlot = $request->string('timeSlot')->value();

        $doctor = User::query()
            ->select(['id', 'clinic_id', 'schedule'])
            ->whereKey($doctorId)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $branchId))
            ->first();

        abort_if(! $doctor, 422, 'Doctor is not assigned to the selected branch.');

        $validSlot = $this->scheduleService->generateSlotsForDoctor($doctor, $branchId, $date)->contains($timeSlot);
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
                'category' => InvoiceItem::CATEGORY_CONSULTATION,
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
}
