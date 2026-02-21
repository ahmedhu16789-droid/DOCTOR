<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AppointmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $clinicId = auth()->user()?->clinic_id;

        return [
            'patientId' => ['required', 'integer', Rule::exists('patients', 'id')->where('clinic_id', $clinicId)],
            'doctorId' => ['required', 'integer', Rule::exists('users', 'id')->where('clinic_id', $clinicId)],
            'branchId' => ['required', 'integer', Rule::exists('branches', 'id')->where('clinic_id', $clinicId)],
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
