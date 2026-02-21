<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\User;
use App\Services\Booking\DoctorScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicBookingController extends Controller
{
    public function __construct(private readonly DoctorScheduleService $scheduleService)
    {
    }

    public function clinicContext(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinicId' => ['required', 'integer', 'exists:clinics,id'],
        ]);

        $clinic = Clinic::query()->findOrFail($validated['clinicId']);
        $branches = Branch::query()
            ->where('clinic_id', $clinic->id)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'location', 'contact_phone']);

        $doctors = User::query()
            ->where('clinic_id', $clinic->id)
            ->where('role', 'DOCTOR')
            ->with(['branches:id'])
            ->orderBy('name')
            ->get(['id', 'name', 'specialty', 'consultation_fee'])
            ->map(fn (User $doctor) => [
                'id' => $doctor->id,
                'name' => $doctor->name,
                'specialty' => $doctor->specialty,
                'consultationFee' => (float) ($doctor->consultation_fee ?? 0),
                'branchIds' => $doctor->branches->pluck('id')->values(),
            ]);

        return response()->json([
            'data' => [
                'clinic' => [
                    'id' => $clinic->id,
                    'name' => $clinic->settings['name'] ?? $clinic->name,
                    'phone' => $clinic->settings['phone'] ?? ($branches->first()->contact_phone ?? ''),
                    'hours' => $clinic->settings['workingHours'] ?? '',
                    'address' => $branches->first()->location ?? '',
                ],
                'branches' => $branches,
                'doctors' => $doctors,
            ],
        ]);
    }

    public function availableSlots(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinicId' => ['required', 'integer', 'exists:clinics,id'],
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
        ]);

        $doctor = User::query()
            ->where('clinic_id', $validated['clinicId'])
            ->where('role', 'DOCTOR')
            ->whereKey($validated['doctorId'])
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        if (! $doctor) {
            return response()->json(['message' => 'Doctor not available in selected branch.'], 422);
        }

        $slots = $this->scheduleService->generateSlotsForDoctor($doctor, $validated['branchId'], $validated['date']);
        $bookedSlots = $this->scheduleService->loadBookedSlots([$doctor->id], $validated['branchId'], $validated['date'], $validated['clinicId']);

        return response()->json([
            'data' => $slots->map(fn (string $time) => [
                'time' => $time,
                'available' => ! in_array($time, $bookedSlots[$doctor->id] ?? [], true),
            ])->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinicId' => ['required', 'integer', 'exists:clinics,id'],
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'timeSlot' => ['required', 'date_format:H:i'],
            'patient.name' => ['required', 'string', 'max:255'],
            'patient.phone' => ['required', 'string', 'max:50'],
            'patient.age' => ['nullable', 'integer', 'min:0', 'max:120'],
            'patient.gender' => ['nullable', 'in:Male,Female'],
        ]);

        $doctor = User::query()
            ->where('clinic_id', $validated['clinicId'])
            ->where('role', 'DOCTOR')
            ->whereKey($validated['doctorId'])
            ->whereHas('branches', fn ($query) => $query->where('branches.id', $validated['branchId']))
            ->first();

        abort_if(! $doctor, 422, 'Doctor is not assigned to the selected branch.');

        $validSlot = $this->scheduleService
            ->generateSlotsForDoctor($doctor, $validated['branchId'], $validated['date'])
            ->contains($validated['timeSlot']);

        abort_if(! $validSlot, 422, 'The selected slot is outside doctor schedule.');

        $bookedSlots = $this->scheduleService->loadBookedSlots([$doctor->id], $validated['branchId'], $validated['date'], $validated['clinicId']);
        abort_if(in_array($validated['timeSlot'], $bookedSlots[$doctor->id] ?? [], true), 422, 'The selected slot is no longer available.');

        $appointment = DB::transaction(function () use ($validated, $doctor): Appointment {
            $patient = Patient::query()->firstOrCreate(
                [
                    'clinic_id' => $validated['clinicId'],
                    'phone' => $validated['patient']['phone'],
                ],
                [
                    'name' => $validated['patient']['name'],
                    'age' => $validated['patient']['age'] ?? 0,
                    'gender' => $validated['patient']['gender'] ?? 'Male',
                    'medical_history_summary' => '',
                ]
            );

            if ($patient->name !== $validated['patient']['name'] || (int) $patient->age !== (int) ($validated['patient']['age'] ?? $patient->age)) {
                $patient->fill([
                    'name' => $validated['patient']['name'],
                    'age' => $validated['patient']['age'] ?? $patient->age,
                    'gender' => $validated['patient']['gender'] ?? $patient->gender,
                ])->save();
            }

            $appointment = Appointment::create([
                'clinic_id' => $validated['clinicId'],
                'patient_id' => $patient->id,
                'doctor_id' => $doctor->id,
                'branch_id' => $validated['branchId'],
                'date' => $validated['date'],
                'time_slot' => $validated['timeSlot'],
                'status' => 'SCHEDULED',
            ]);

            $invoice = Invoice::create([
                'clinic_id' => $validated['clinicId'],
                'appointment_id' => $appointment->id,
                'total' => (float) ($doctor->consultation_fee ?? 0),
                'paid_amount' => 0,
                'status' => 'UNPAID',
            ]);

            InvoiceItem::query()->create([
                'clinic_id' => $validated['clinicId'],
                'invoice_id' => $invoice->id,
                'service_id' => 'srv_cns',
                'name' => 'Consultation Fee',
                'category' => InvoiceItem::CATEGORY_CONSULTATION,
                'quantity' => 1,
                'unit_price' => (float) ($doctor->consultation_fee ?? 0),
                'total' => (float) ($doctor->consultation_fee ?? 0),
                'added_by' => null,
            ]);

            return $appointment;
        });

        return response()->json([
            'message' => 'Appointment booked successfully.',
            'data' => ['appointmentId' => $appointment->id],
        ], 201);
    }
}

