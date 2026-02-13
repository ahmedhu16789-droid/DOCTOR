<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PatientResource;
use App\Models\Patient;

class PatientController extends Controller
{
    public function index()
    {
        return PatientResource::collection(
            Patient::query()
                ->select(['id', 'clinic_id', 'name', 'phone', 'gender', 'age', 'medical_history_summary', 'created_at'])
                ->latest('created_at')
                ->simplePaginate(50)
        );
    }
}
