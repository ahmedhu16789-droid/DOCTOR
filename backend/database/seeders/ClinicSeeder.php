<?php

namespace Database\Seeders;

use App\Models\Clinic;
use Illuminate\Database\Seeder;

class ClinicSeeder extends Seeder
{
    public function run(): void
    {
        Clinic::query()->updateOrCreate(
            ['name' => 'عيادات الفتح'],
            [
                'subscription_status' => 'active',
                'settings' => [
                    'currency' => 'EGP',
                    'timezone' => 'Africa/Cairo',
                ],
                'public_uuid' => (string) \Illuminate\Support\Str::uuid(),
            ]
        );
    }
}
