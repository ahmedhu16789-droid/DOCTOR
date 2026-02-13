<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DoctorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'specialty' => $this->specialty,
            'consultationFee' => (float) ($this->consultation_fee ?? 0),
            'assignedBranches' => $this->branches->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
            'schedule' => collect($this->schedule ?? [])->map(function (array $shift): array {
                return [
                    'id' => (string) ($shift['id'] ?? uniqid('shift_', true)),
                    'dayOfWeek' => (int) ($shift['dayOfWeek'] ?? 0),
                    'startTime' => (string) ($shift['startTime'] ?? '09:00'),
                    'endTime' => (string) ($shift['endTime'] ?? '17:00'),
                    'slotDuration' => (int) ($shift['slotDuration'] ?? 20),
                    'branchId' => isset($shift['branchId']) ? (string) $shift['branchId'] : null,
                ];
            })->values()->all(),
            'payroll' => [
                'model' => $this->payroll['model'] ?? 'PERCENTAGE',
                'baseSalary' => (float) ($this->payroll['baseSalary'] ?? 0),
                'commissionPercentage' => isset($this->payroll['commissionPercentage']) ? (float) $this->payroll['commissionPercentage'] : null,
                'effectiveDate' => $this->payroll['effectiveDate'] ?? now()->toDateString(),
            ],
        ];
    }
}
