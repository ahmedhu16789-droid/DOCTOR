<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DoctorUpsertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'specialty' => ['required', Rule::in(['Orthopedics', 'Cardiology', 'Dentistry', 'Internal Medicine', 'Pediatrics', 'Dermatology'])],
            'consultationFee' => ['required', 'numeric', 'min:0'],
            'assignedBranches' => ['required', 'array', 'min:1'],
            'assignedBranches.*' => ['integer', 'exists:branches,id'],
            'payroll' => ['required', 'array'],
            'payroll.model' => ['required', Rule::in(['FIXED_SALARY', 'PERCENTAGE', 'HYBRID'])],
            'payroll.baseSalary' => ['required', 'numeric', 'min:0'],
            'payroll.commissionPercentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'schedule' => ['nullable', 'array'],
            'schedule.*.dayOfWeek' => ['required', 'integer', 'between:0,6'],
            'schedule.*.startTime' => ['required', 'date_format:H:i'],
            'schedule.*.endTime' => ['required', 'date_format:H:i'],
            'schedule.*.slotDuration' => ['required', 'integer', 'min:5', 'max:120'],
            'schedule.*.branchId' => ['nullable', 'integer', 'exists:branches,id'],
            'examFindingTemplates' => ['nullable', 'array', 'max:30'],
            'examFindingTemplates.*' => ['string', 'min:2', 'max:180'],
            'diagnosisTemplates' => ['nullable', 'array', 'max:30'],
            'diagnosisTemplates.*' => ['string', 'min:2', 'max:180'],
            'planTemplates' => ['nullable', 'array', 'max:30'],
            'planTemplates.*' => ['string', 'min:2', 'max:180'],
        ];
    }
}
