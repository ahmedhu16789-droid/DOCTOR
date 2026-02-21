<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Get last visit from the latest completed appointment date
        $lastVisit = $this->whenLoaded('appointments', function () {
            return $this->appointments
                ->where('status', 'COMPLETED')
                ->sortByDesc('date')
                ->first()
                ?->date;
        }, null);

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'gender' => $this->gender,
            'age' => $this->age,
            'medicalHistorySummary' => $this->medical_history_summary,
            'consents' => [
                'treatment' => (bool) optional($this->consents?->firstWhere('consent_type', 'treatment'))->granted,
                'privacy' => (bool) optional($this->consents?->firstWhere('consent_type', 'privacy'))->granted,
                'communication' => (bool) optional($this->consents?->firstWhere('consent_type', 'communication'))->granted,
            ],
            'lastVisit' => $lastVisit,
            'duplicateHint' => $this->when(isset($this->duplicate_hint), $this->duplicate_hint),
        ];
    }
}
