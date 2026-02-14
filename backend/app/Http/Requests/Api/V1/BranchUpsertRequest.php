<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class BranchUpsertRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'location' => ['required', 'string', 'min:3', 'max:255'],
            'contactPhone' => ['required', 'string', 'min:8', 'max:30'],
            'isActive' => ['required', 'boolean'],
        ];
    }
}
