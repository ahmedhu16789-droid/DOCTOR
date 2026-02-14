<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'location' => $this->location,
            'contactPhone' => $this->contact_phone,
            'isActive' => (bool) $this->is_active,
        ];
    }
}
