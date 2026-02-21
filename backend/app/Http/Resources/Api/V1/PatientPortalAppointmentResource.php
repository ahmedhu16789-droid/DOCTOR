<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientPortalAppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'date' => optional($this->date)?->toDateString(),
            'timeSlot' => $this->time_slot,
            'status' => $this->status,
            'doctor' => [
                'id' => (string) $this->doctor_id,
                'name' => $this->doctor?->name,
                'specialty' => $this->doctor?->specialty,
            ],
            'branch' => [
                'id' => (string) $this->branch_id,
                'name' => $this->branch?->name,
                'location' => $this->branch?->location,
            ],
            'canReschedule' => in_array($this->status, ['SCHEDULED', 'WAITING'], true),
            'canCancel' => in_array($this->status, ['SCHEDULED', 'WAITING'], true),
        ];
    }
}
