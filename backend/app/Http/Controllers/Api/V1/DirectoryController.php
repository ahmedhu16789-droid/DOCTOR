<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\Request;

class DirectoryController extends Controller
{
    public function branches(Request $request)
    {
        return response()->json([
            'data' => Branch::query()
                ->select(['id', 'name', 'location', 'contact_phone', 'is_active'])
                ->orderBy('id')
                ->get()
                ->map(fn (Branch $branch): array => [
                    'id' => (string) $branch->id,
                    'name' => $branch->name,
                    'location' => $branch->location,
                    'contactPhone' => $branch->contact_phone,
                    'isActive' => (bool) $branch->is_active,
                ])
                ->all(),
        ]);
    }

    public function departments(Request $request)
    {
        return response()->json([
            'data' => [
                ['value' => 'Orthopedics', 'labelEn' => 'Orthopedics', 'labelAr' => 'العظام'],
                ['value' => 'Cardiology', 'labelEn' => 'Cardiology', 'labelAr' => 'القلب'],
                ['value' => 'Dentistry', 'labelEn' => 'Dentistry', 'labelAr' => 'الأسنان'],
                ['value' => 'Internal Medicine', 'labelEn' => 'Internal Medicine', 'labelAr' => 'الباطنة'],
                ['value' => 'Pediatrics', 'labelEn' => 'Pediatrics', 'labelAr' => 'الأطفال'],
                ['value' => 'Dermatology', 'labelEn' => 'Dermatology', 'labelAr' => 'الجلدية'],
            ],
        ]);
    }
}
