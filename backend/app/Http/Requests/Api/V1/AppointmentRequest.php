<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class AppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'patientId' => ['required', 'integer', 'exists:patients,id'],
            'doctorId' => ['required', 'integer', 'exists:users,id'],
            'branchId' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'timeSlot' => ['required', 'date_format:H:i'],
            'status' => ['nullable', 'in:SCHEDULED,WAITING,IN_PROGRESS,COMPLETED,CANCELLED,NO_SHOW'],
            'billing' => ['required', 'array'],
            'billing.total' => ['required', 'numeric', 'min:0'],
            'billing.paidAmount' => ['required', 'numeric', 'min:0'],
            'billing.status' => ['required', 'in:PAID,UNPAID,PARTIAL'],
        ];
    }
}
