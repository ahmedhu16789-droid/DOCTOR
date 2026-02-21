<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class BranchSettingsUpsertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'defaultSlotDurationMinutes' => ['required', 'integer', 'min:5', 'max:180'],
            'workingHours' => ['required', 'array'],
            'workingHours.start' => ['required', 'date_format:H:i'],
            'workingHours.end' => ['required', 'date_format:H:i'],
            'workingHours.days' => ['required', 'array', 'min:1'],
            'workingHours.days.*' => ['integer', 'between:0,6'],
            'queueRules' => ['required', 'array'],
            'queueRules.maxWaitingPatients' => ['required', 'integer', 'min:1', 'max:1000'],
            'queueRules.allowOverbooking' => ['required', 'boolean'],
            'queueRules.autoCallEnabled' => ['required', 'boolean'],
            'operationalFlags' => ['required', 'array'],
            'operationalFlags.allowWalkIns' => ['required', 'boolean'],
            'operationalFlags.enableTelehealth' => ['required', 'boolean'],
            'operationalFlags.requirePrepayment' => ['required', 'boolean'],
        ];
    }
}
