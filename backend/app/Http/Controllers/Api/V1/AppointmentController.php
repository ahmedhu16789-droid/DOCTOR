<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Events\AppointmentNotificationRequested;
use App\Http\Requests\Api\V1\AppointmentRequest;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\AppointmentStatusAudit;
use App\Models\AppointmentSlotShift;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use App\Services\Booking\DoctorScheduleService;
use App\Services\Notifications\NotificationEvent;
use App\Support\ApiCache;
use App\Support\Authorization\ClinicBranchAuthorization;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AppointmentController extends Controller
{
    public function __construct(
        private readonly DoctorScheduleService $scheduleService,
        private readonly ClinicBranchAuthorization $authorization,
    ) {
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
                ->select(['id', 'clinic_id', 'patient_id', 'doctor_id', 'branch_id', 'date', 'time_slot', 'status', 'check_in_at', 'called_at', 'started_at', 'completed_at', 'no_show_at'])
                ->with(['clinic:id,settings', 'doctor:id,name,specialty', 'invoice:id,appointment_id,total,paid_amount,status,lifecycle_state', 'invoice.items:id,invoice_id,service_id,name,quantity,unit_price,total', 'invoice.auditLogs.actor:id,name', 'encounter:id,appointment_id,status', 'notificationLogs'])
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

        $this->authorization->assertRole($request->user(), ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST']);
        $this->authorize('applyShiftSuggestion', [Appointment::class, (int) $validated['doctorId'], (int) $validated['branchId']]);

        $clinicId = $request->user()->clinic_id;

        $doctor = User::query()
            ->select(['id'])
            ->whereKey($validated['doctorId'])
            ->where('clinic_id', $clinicId)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        $this->authorization->assertDoctorAssignedToBranch((bool) $doctor);

        $shiftedData = [];
        $shiftedCount = DB::transaction(function () use ($clinicId, $validated, $request, &$shiftedData): int {
            $appointments = Appointment::query()
                ->where('clinic_id', $clinicId)
                ->where('doctor_id', $validated['doctorId'])
                ->where('branch_id', $validated['branchId'])
                ->whereDate('date', $validated['date'])
                ->where('time_slot', '>=', $validated['fromTime'])
                ->whereNotIn('status', ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
                ->orderBy('time_slot')
                ->with('patient:id,name,phone')
                ->lockForUpdate()
                ->get();

            foreach ($appointments as $appointment) {
                $beforeTime = $appointment->time_slot;
                $afterTime = Carbon::createFromFormat('H:i', $appointment->time_slot)
                        ->addMinutes($validated['shiftMinutes'])
                        ->format('H:i');

                $appointment->update([
                    'time_slot' => $afterTime,
                ]);

                $shiftedData[] = [
                    'appointmentId' => (string) $appointment->id,
                    'patientId' => (string) $appointment->patient_id,
                    'patientName' => $appointment->patient?->name,
                    'patientPhone' => $appointment->patient?->phone,
                    'beforeTime' => $beforeTime,
                    'afterTime' => $afterTime,
                ];
            }

            if ($appointments->isEmpty()) {
                // We no longer return 0 here. 
                // We want to create the AppointmentSlotShift rule anyway
                // so that future UNBOOKED slots reflect this shift.
            }

            AppointmentSlotShift::query()->create([
                'clinic_id' => $clinicId,
                'doctor_id' => $validated['doctorId'],
                'branch_id' => $validated['branchId'],
                'date' => $validated['date'],
                'from_time' => $validated['fromTime'],
                'shift_minutes' => $validated['shiftMinutes'],
                'applied_by_user_id' => $request->user()->id,
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
                'shiftedData' => $shiftedData,
            ],
        ]);
    }

    public function delayInsight(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $this->authorization->assertRole($request->user(), ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST']);
        $this->authorize('viewTimeline', [Appointment::class, (int) $validated['doctorId'], (int) $validated['branchId']]);

        $clinicId = $request->user()->clinic_id;
        $date = (string) ($validated['date'] ?? now()->toDateString());

        $doctor = User::query()
            ->select(['id'])
            ->whereKey($validated['doctorId'])
            ->where('clinic_id', $clinicId)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        $this->authorization->assertDoctorAssignedToBranch((bool) $doctor);

        $appointments = Appointment::query()
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $validated['doctorId'])
            ->where('branch_id', $validated['branchId'])
            ->whereDate('date', $date)
            ->orderBy('time_slot')
            ->get();

        $timezone = data_get($request->user()->clinic?->settings, 'timezone', config('app.timezone', 'UTC'));
        $now = now()->timezone($timezone);
        $graceMinutes = max(0, (int) config('appointments.delay_detection.grace_minutes', 5));
        $thresholdMinutes = max(1, (int) config('appointments.delay_detection.threshold_minutes', 10));
        $roundingMinutes = max(1, (int) config('appointments.delay_detection.rounding_minutes', 5));
        $mode = (string) config('appointments.delay_detection.mode', 'scheduled_start');

        $activeStatuses = ['WAITING', 'CALLED', 'IN_PROGRESS'];
        $current = $appointments
            ->first(fn (Appointment $appointment) => in_array($appointment->status, $activeStatuses, true));

        if (! $current) {
            $current = $appointments
                ->first(fn (Appointment $appointment) => $appointment->status === 'SCHEDULED' && $appointment->time_slot <= $now->format('H:i'));
        }

        if (! $current) {
            return response()->json([
                'data' => [
                    'showAlert' => false,
                    'reason' => 'No active delayed appointment found.',
                    'delayMinutes' => 0,
                    'impactedCount' => 0,
                    'suggestedShiftMinutes' => 0,
                    'fromTime' => null,
                    'preview' => [],
                    'config' => [
                        'graceMinutes' => $graceMinutes,
                        'thresholdMinutes' => $thresholdMinutes,
                        'roundingMinutes' => $roundingMinutes,
                        'mode' => $mode,
                    ],
                ],
            ]);
        }

        $currentStart = Carbon::createFromFormat('Y-m-d H:i', sprintf('%s %s', $date, $current->time_slot), $timezone);
        $referenceTime = $currentStart;

        if ($mode === 'expected_end') {
            $slotDuration = $this->resolveDoctorSlotDuration($request->user()->clinic_id, (int) $validated['doctorId'], (int) $validated['branchId'], $currentStart);
            $referenceTime = $currentStart->copy()->addMinutes($slotDuration);
        }

        $rawDelayMinutes = max(0, $referenceTime->diffInMinutes($now, false) - $graceMinutes);
        $roundedShift = $rawDelayMinutes > 0
            ? (int) (ceil($rawDelayMinutes / $roundingMinutes) * $roundingMinutes)
            : 0;

        $preservedStatuses = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
        $upcoming = $appointments
            ->filter(fn (Appointment $appointment) => $appointment->time_slot > $current->time_slot)
            ->values();

        $impacted = $upcoming
            ->filter(fn (Appointment $appointment) => ! in_array($appointment->status, $preservedStatuses, true))
            ->values();

        $preview = $impacted->map(function (Appointment $appointment) use ($date, $timezone, $roundedShift): array {
            $before = Carbon::createFromFormat('Y-m-d H:i', sprintf('%s %s', $date, $appointment->time_slot), $timezone);

            return [
                'appointmentId' => (string) $appointment->id,
                'patientId' => (string) $appointment->patient_id,
                'status' => (string) $appointment->status,
                'beforeTime' => $appointment->time_slot,
                'afterTime' => $before->copy()->addMinutes($roundedShift)->format('H:i'),
            ];
        })->values();

        return response()->json([
            'data' => [
                'showAlert' => $rawDelayMinutes >= $thresholdMinutes && $roundedShift > 0 && $impacted->isNotEmpty(),
                'delayMinutes' => $rawDelayMinutes,
                'impactedCount' => $impacted->count(),
                'suggestedShiftMinutes' => $roundedShift,
                'fromTime' => $upcoming->first()?->time_slot,
                'preview' => $preview,
                'config' => [
                    'graceMinutes' => $graceMinutes,
                    'thresholdMinutes' => $thresholdMinutes,
                    'roundingMinutes' => $roundingMinutes,
                    'mode' => $mode,
                ],
            ],
        ]);
    }

    public function delayShiftPreview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'fromTime' => ['required', 'date_format:H:i'],
            'shiftMinutes' => ['required', 'integer', 'min:1', 'max:720'],
        ]);

        $this->authorization->assertRole($request->user(), ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST']);
        $this->authorize('applyShiftSuggestion', [Appointment::class, (int) $validated['doctorId'], (int) $validated['branchId']]);

        $clinicId = $request->user()->clinic_id;
        $timezone = data_get($request->user()->clinic?->settings, 'timezone', config('app.timezone', 'UTC'));

        $appointments = Appointment::query()
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $validated['doctorId'])
            ->where('branch_id', $validated['branchId'])
            ->whereDate('date', $validated['date'])
            ->where('time_slot', '>=', $validated['fromTime'])
            ->orderBy('time_slot')
            ->get();

        $preservedStatuses = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

        $preview = $appointments->map(function (Appointment $appointment) use ($validated, $timezone, $preservedStatuses): array {
            $before = Carbon::createFromFormat('Y-m-d H:i', sprintf('%s %s', $validated['date'], $appointment->time_slot), $timezone);
            $preserved = in_array($appointment->status, $preservedStatuses, true);

            return [
                'appointmentId' => (string) $appointment->id,
                'status' => (string) $appointment->status,
                'preserved' => $preserved,
                'beforeTime' => $appointment->time_slot,
                'afterTime' => $preserved ? $appointment->time_slot : $before->copy()->addMinutes((int) $validated['shiftMinutes'])->format('H:i'),
            ];
        })->values();

        return response()->json([
            'data' => [
                'doctorId' => (string) $validated['doctorId'],
                'branchId' => (string) $validated['branchId'],
                'date' => $validated['date'],
                'fromTime' => $validated['fromTime'],
                'shiftMinutes' => (int) $validated['shiftMinutes'],
                'preview' => $preview,
            ],
        ]);
    }

    public function reschedule(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorization->assertTenantOwnership($request->user(), $appointment);
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);
        $this->authorize('reschedule', $appointment);

        $validated = $request->validate([
            'doctorId' => ['nullable', 'integer', 'exists:users,id'],
            'branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'timeSlot' => ['required', 'date_format:H:i'],
        ]);

        $doctorId = (int) ($validated['doctorId'] ?? $appointment->doctor_id);
        $branchId = (int) ($validated['branchId'] ?? $appointment->branch_id);

        if ($request->user()->role === 'DOCTOR') {
            abort_if($doctorId !== (int) $appointment->doctor_id, 403, 'Doctors can only reschedule their own appointments.');
            abort_if($branchId !== (int) $appointment->branch_id, 403, 'Doctors can only reschedule inside the same branch.');
            abort_if($validated['date'] !== $appointment->date?->toDateString(), 403, 'Doctors can only reschedule same-day appointments.');
        }

        $doctor = User::query()
            ->select(['id', 'clinic_id', 'schedule'])
            ->whereKey($doctorId)
            ->where('clinic_id', $request->user()->clinic_id)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $branchId))
            ->first();

        $this->authorization->assertDoctorAssignedToBranch((bool) $doctor);

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

        AppointmentNotificationRequested::dispatch($appointment->fresh(), NotificationEvent::APPOINTMENT_RESCHEDULED);

        $appointment->load(['clinic:id,settings', 'doctor:id,name,specialty', 'invoice.items', 'invoice.auditLogs.actor:id,name', 'encounter:id,appointment_id,status', 'notificationLogs']);

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function updateStatus(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorization->assertTenantOwnership($request->user(), $appointment);

        $validated = $request->validate([
            'status' => ['required', 'in:SCHEDULED,WAITING,CALLED,IN_PROGRESS,COMPLETED,CANCELLED,NO_SHOW'],
        ]);

        $status = $validated['status'];

        if ($status === 'CANCELLED') {
            $this->authorize('cancel', $appointment);
        }

        $appointment->status = $status;

        if ($status === 'WAITING' && ! $appointment->check_in_at) {
            $appointment->check_in_at = now();
        }

        if ($status === 'CALLED' && ! $appointment->called_at) {
            $appointment->called_at = now();
            $appointment->check_in_at = $appointment->check_in_at ?? now();
        }

        if ($status === 'IN_PROGRESS') {
            $appointment->started_at = $appointment->started_at ?? now();
            $appointment->called_at = $appointment->called_at ?? now();
            $appointment->check_in_at = $appointment->check_in_at ?? $appointment->called_at;
        }

        if ($status === 'COMPLETED') {
            $appointment->completed_at = now();
            $appointment->started_at = $appointment->started_at ?? now();
            $appointment->called_at = $appointment->called_at ?? $appointment->started_at;
            $appointment->check_in_at = $appointment->check_in_at ?? $appointment->called_at;
        }

        if ($status === 'NO_SHOW') {
            $appointment->no_show_at = now();
        } elseif ($status !== 'NO_SHOW') {
            $appointment->no_show_at = null;
        }

        $appointment->save();

        if ($status === 'CANCELLED') {
            AppointmentNotificationRequested::dispatch($appointment->fresh(), NotificationEvent::APPOINTMENT_CANCELLED);
        }

        if ($status === 'NO_SHOW') {
            AppointmentNotificationRequested::dispatch($appointment->fresh(), NotificationEvent::APPOINTMENT_NO_SHOW);
        }
        $appointment->load(['clinic:id,settings', 'doctor:id,name,specialty', 'invoice.items', 'invoice.auditLogs.actor:id,name', 'encounter:id,appointment_id,status', 'notificationLogs']);

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function startNow(Request $request, Appointment $appointment): JsonResponse
    {
        $this->authorization->assertTenantOwnership($request->user(), $appointment);

        $this->authorize('startNow', $appointment);

        $allowedStatuses = ['SCHEDULED', 'WAITING'];
        abort_unless(in_array($appointment->status, $allowedStatuses, true), 422, 'Only scheduled or waiting appointments can be started now.');

        $hasAnotherInProgress = Appointment::query()
            ->where('clinic_id', $appointment->clinic_id)
            ->where('doctor_id', $appointment->doctor_id)
            ->whereDate('date', $appointment->date)
            ->where('status', 'IN_PROGRESS')
            ->whereKeyNot($appointment->id)
            ->exists();

        abort_if($hasAnotherInProgress, 409, 'Doctor already has an in-progress visit. Please end it first.');

        DB::transaction(function () use ($appointment, $request): void {
            $fromStatus = $appointment->status;
            $now = now();

            $appointment->status = 'IN_PROGRESS';
            $appointment->started_at = $appointment->started_at ?? $now;
            $appointment->check_in_at = $appointment->check_in_at ?? $now;
            $appointment->called_at = $appointment->called_at ?? $appointment->check_in_at;
            $appointment->save();

            AppointmentStatusAudit::query()->withoutGlobalScopes()->create([
                'clinic_id' => $appointment->clinic_id,
                'appointment_id' => $appointment->id,
                'from_status' => $fromStatus,
                'to_status' => 'IN_PROGRESS',
                'actor_type' => 'USER',
                'actor_id' => $request->user()->id,
                'action' => 'START_VISIT_NOW',
                'reason' => 'Operator started visit early from queue.',
                'metadata' => [
                    'scheduled_date' => $appointment->date?->toDateString(),
                    'scheduled_time_slot' => $appointment->time_slot,
                    'started_at' => optional($appointment->started_at)->toIso8601String(),
                ],
                'created_at' => $now,
            ]);
        });

        $appointment->load(['clinic:id,settings', 'doctor:id,name,specialty', 'invoice.items', 'invoice.auditLogs.actor:id,name', 'encounter:id,appointment_id,status', 'notificationLogs']);

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    private function resolveDoctorSlotDuration(int $clinicId, int $doctorId, int $branchId, Carbon $date): int
    {
        $doctor = User::query()
            ->select(['id', 'schedule'])
            ->whereKey($doctorId)
            ->where('clinic_id', $clinicId)
            ->where('role', 'DOCTOR')
            ->first();

        $dayOfWeek = (int) $date->dayOfWeek;

        $slot = collect($doctor?->schedule ?? [])->first(function (array $shift) use ($branchId, $dayOfWeek, $date): bool {
            if ((int) ($shift['dayOfWeek'] ?? -1) !== $dayOfWeek) {
                return false;
            }

            if ((int) ($shift['branchId'] ?? 0) !== $branchId) {
                return false;
            }

            $start = (string) ($shift['startTime'] ?? '00:00');
            $end = (string) ($shift['endTime'] ?? '23:59');
            $time = $date->format('H:i');

            return $time >= $start && $time < $end;
        });

        return max(5, (int) ($slot['slotDuration'] ?? 20));
    }

    public function store(AppointmentRequest $request): JsonResponse
    {
        $doctorId = $request->integer('doctorId');
        $branchId = $request->integer('branchId');
        $date = $request->string('date')->value();
        $timeSlot = $request->string('timeSlot')->value();
        $earlyCheckinForAppointmentId = $request->integer('earlyCheckinForAppointmentId') ?: null;

        // Validate early check-in target if provided
        $earlyCheckinOriginal = null;
        if ($earlyCheckinForAppointmentId) {
            $earlyCheckinOriginal = Appointment::query()
                ->where('clinic_id', $request->user()->clinic_id)
                ->where('patient_id', $request->integer('patientId'))
                ->whereIn('status', ['SCHEDULED', 'WAITING'])
                ->whereKey($earlyCheckinForAppointmentId)
                ->first();

            abort_if(! $earlyCheckinOriginal, 422, 'The original appointment was not found or is already in progress.');
        }

        $doctor = User::query()
            ->select(['id', 'clinic_id', 'schedule'])
            ->whereKey($doctorId)
            ->where('role', 'DOCTOR')
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $branchId))
            ->first();

        $this->authorization->assertDoctorAssignedToBranch((bool) $doctor);

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

        $appointment = DB::transaction(function () use ($request, $doctorId, $branchId, $date, $timeSlot, $earlyCheckinOriginal): Appointment {
            // Silently cancel the original appointment (no notification)
            if ($earlyCheckinOriginal) {
                $earlyCheckinOriginal->update([
                    'status' => 'CANCELLED',
                    'cancellation_reason' => 'EARLY_CHECKIN',
                ]);
            }

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

            return $appointment->load('invoice.items', 'invoice.auditLogs.actor:id,name');
        });

        AppointmentNotificationRequested::dispatch($appointment->fresh(), NotificationEvent::APPOINTMENT_CREATED);

        ApiCache::bump('appointments.index', $request->user()->clinic_id);

        return response()->json(new AppointmentResource($appointment), 201);
    }
}
