<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AppointmentRequest;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $appointments = Appointment::query()
            ->with('invoice')
            ->when($request->filled('branchId'), fn ($query) => $query->where('branch_id', $request->integer('branchId')))
            ->when($request->filled('doctorId'), fn ($query) => $query->where('doctor_id', $request->integer('doctorId')))
            ->latest('date')
            ->paginate(20);

        return AppointmentResource::collection($appointments);
    }

    public function store(AppointmentRequest $request): JsonResponse
    {
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
