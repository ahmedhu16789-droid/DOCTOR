<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

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


    public function roles(Request $request)
    {
        $clinicId = $request->user()->clinic_id;

        $roles = Role::query()
            ->select(['name'])
            ->where('guard_name', 'web')
            ->where(function ($query) use ($clinicId): void {
                $query->whereNull('clinic_id')->orWhere('clinic_id', $clinicId);
            })
            ->orderBy('name')
            ->pluck('name')
            ->values()
            ->all();

        return response()->json([
            'data' => $roles,
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
