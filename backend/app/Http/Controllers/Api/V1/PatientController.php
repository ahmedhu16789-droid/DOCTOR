<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PatientResource;
use App\Models\Patient;

class PatientController extends Controller
{
    public function index()
    {
        return PatientResource::collection(Patient::query()->latest()->paginate(50));
    }
}
