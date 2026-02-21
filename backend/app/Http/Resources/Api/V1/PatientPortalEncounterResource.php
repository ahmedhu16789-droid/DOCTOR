<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientPortalEncounterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'appointment' => [
                'id' => (string) $this->appointment_id,
                'date' => optional($this->appointment?->date)?->toDateString(),
                'timeSlot' => $this->appointment?->time_slot,
                'doctorName' => $this->appointment?->doctor?->name,
            ],
            'status' => $this->status,
            'diagnosis' => $this->diagnosis,
            'plan' => $this->plan,
            'nextVisitDate' => optional($this->next_visit_date)?->toDateString(),
            'prescriptions' => PatientPortalPrescriptionResource::collection($this->whenLoaded('prescriptions')),
        ];
    }
}
