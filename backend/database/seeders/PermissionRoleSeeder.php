<?php

namespace Database\Seeders;

use App\Models\Clinic;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PermissionRoleSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('roles')) {
            return;
        }

        $permissions = [
            'create_appointment',
            'view_appointment',
            'update_appointment',
            'cancel_appointment',
            'create_patient',
            'view_patient',
            'update_patient',
            'create_branch',
            'view_branch',
            'manage_staff',
            'manage_roles',
            'view_financials',
            'create_transaction',
            'finance.view_reports',
            'finance.collect_payment',
            'finance.refund',
            'finance.remove_item',
            'payroll.close',
            'payroll.settle',
        ];

        foreach ($permissions as $permissionName) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $permissionName, 'guard_name' => 'web'],
                ['updated_at' => now(), 'created_at' => now()]
            );
        }

        $clinicId = Clinic::query()->where('name', 'عيادات الفتح')->value('id');

        $roles = [
            'ADMIN' => $permissions,
            'BRANCH_MANAGER' => ['view_appointment', 'update_appointment', 'view_patient', 'manage_staff', 'view_branch', 'finance.collect_payment', 'finance.remove_item', 'finance.refund', 'finance.view_reports', 'payroll.close', 'payroll.settle'],
            'DOCTOR' => ['view_appointment', 'update_appointment', 'view_patient', 'create_patient'],
            'NURSE' => ['view_appointment', 'view_patient', 'update_patient'],
            'RECEPTIONIST' => ['create_appointment', 'view_appointment', 'cancel_appointment', 'create_patient', 'view_patient', 'create_transaction', 'finance.collect_payment'],
            'FINANCE_ADMIN' => ['view_financials', 'create_transaction', 'finance.view_reports', 'finance.collect_payment', 'finance.refund', 'finance.remove_item', 'payroll.close', 'payroll.settle'],
        ];

        foreach ($roles as $roleName => $rolePermissions) {
            $roleId = DB::table('roles')->where('name', $roleName)->where('guard_name', 'web')->where('clinic_id', $clinicId)->value('id');

            if (! $roleId) {
                $roleId = DB::table('roles')->insertGetId([
                    'name' => $roleName,
                    'guard_name' => 'web',
                    'clinic_id' => $clinicId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            foreach ($rolePermissions as $permissionName) {
                $permissionId = DB::table('permissions')->where('name', $permissionName)->where('guard_name', 'web')->value('id');

                if (! $permissionId) {
                    continue;
                }

                DB::table('role_has_permissions')->updateOrInsert(
                    ['permission_id' => $permissionId, 'role_id' => $roleId],
                    []
                );
            }
        }
    }
}
