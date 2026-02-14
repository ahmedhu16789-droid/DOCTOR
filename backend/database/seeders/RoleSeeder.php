<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'ADMIN',
            'DOCTOR',
            'RECEPTIONIST',
            'NURSE',
            'PHARMACY_MANAGER',
            'BRANCH_MANAGER',
        ];

        foreach ($roles as $roleName) {
            Role::firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web'],
                ['name' => $roleName, 'guard_name' => 'web']
            );
        }

        $this->command->info('Roles seeded successfully.');
    }
}
