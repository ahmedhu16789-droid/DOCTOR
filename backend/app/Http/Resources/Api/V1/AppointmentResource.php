<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'patientId' => (string) $this->patient_id,
            'doctorId' => (string) $this->doctor_id,
            'branchId' => (string) $this->branch_id,
            'doctorName' => $this->doctor?->name ?? 'Doctor',
            'date' => $this->date,
            'timeSlot' => $this->time_slot,
            'status' => $this->status,
            'billing' => [
                'total' => (float) ($this->invoice?->total ?? 0),
                'paidAmount' => (float) ($this->invoice?->paid_amount ?? 0),
                'status' => $this->invoice?->status ?? 'UNPAID',
                'items' => $this->invoice?->items?->map(fn ($item) => [
                    'id' => (string) $item->id,
                    'serviceId' => $item->service_id,
                    'name' => $item->name,
                    'quantity' => (int) $item->quantity,
                    'unitPrice' => (float) $item->unit_price,
                    'total' => (float) $item->total,
                ])->values() ?? [],
            ],
            'encounterStatus' => $this->encounter?->status,
        ];
    }
}
