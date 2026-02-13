<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Clinic;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::query()->where('name', 'عيادات الفتح')->first();

        if (! $clinic) {
            return;
        }

        $branches = [
            [
                'name' => 'فرع المعادي',
                'location' => 'المعادي - القاهرة',
                'contact_phone' => '0100000001',
                'is_active' => true,
            ],
            [
                'name' => 'فرع مدينة نصر',
                'location' => 'مدينة نصر - القاهرة',
                'contact_phone' => '0100000002',
                'is_active' => true,
            ],
            [
                'name' => 'فرع أكتوبر',
                'location' => '6 أكتوبر - الجيزة',
                'contact_phone' => '0100000003',
                'is_active' => true,
            ],
        ];

        foreach ($branches as $branch) {
            Branch::query()->updateOrCreate(
                [
                    'clinic_id' => $clinic->id,
                    'name' => $branch['name'],
                ],
                [
                    'location' => $branch['location'],
                    'contact_phone' => $branch['contact_phone'],
                    'is_active' => $branch['is_active'],
                ]
            );
        }
    }
}
