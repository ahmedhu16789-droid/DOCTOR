<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $adminEmail = 'owner@system.com';
        
        $user = User::query()->updateOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'Platform Super Admin',
                'password' => 'password123',
                'role' => 'PLATFORM_ADMIN',
                'clinic_id' => null, // Not tied to any clinic
                'is_platform_admin' => true,
            ]
        );

        // We do *not* seed Spatie's model_has_roles here because Spatie is used for 
        // clinic-specific RBAC (Role-Based Access Control) in this system. 
        // Platform Admins are handled via the `is_platform_admin` column and `platform.admin` middleware.

        $this->command->info("Platform Super Admin seeded successfully! Email: {$adminEmail} / Password: password123");
    }
}
