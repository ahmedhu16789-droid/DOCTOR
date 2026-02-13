<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Clinic;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $clinic = Clinic::query()->where('name', 'عيادات الفتح')->first();

        if (! $clinic) {
            return;
        }

        $branches = Branch::query()->where('clinic_id', $clinic->id)->get()->keyBy('name');

        $users = [
            [
                'name' => 'مالك العيادة',
                'email' => 'owner@alfath-clinic.com',
                'role' => 'ADMIN',
                'specialty' => null,
                'consultation_fee' => null,
                'schedule' => null,
                'payroll' => ['model' => 'FIXED_SALARY', 'baseSalary' => 0, 'effectiveDate' => now()->toDateString()],
                'branches' => ['فرع المعادي', 'فرع مدينة نصر', 'فرع أكتوبر'],
            ],
            [
                'name' => 'مدير فرع المعادي',
                'email' => 'manager.madi@alfath-clinic.com',
                'role' => 'BRANCH_MANAGER',
                'specialty' => null,
                'consultation_fee' => null,
                'schedule' => null,
                'payroll' => ['model' => 'FIXED_SALARY', 'baseSalary' => 12000, 'effectiveDate' => now()->toDateString()],
                'branches' => ['فرع المعادي'],
            ],
            [
                'name' => 'د. سارة أحمد',
                'email' => 'dr.sara@alfath-clinic.com',
                'role' => 'DOCTOR',
                'specialty' => 'Cardiology',
                'consultation_fee' => 500,
                'schedule' => [
                    ['dayOfWeek' => 1, 'startTime' => '09:00', 'endTime' => '14:00', 'branchId' => null, 'slotDuration' => 20],
                    ['dayOfWeek' => 3, 'startTime' => '10:00', 'endTime' => '15:00', 'branchId' => null, 'slotDuration' => 20],
                ],
                'payroll' => ['model' => 'PERCENTAGE', 'baseSalary' => 0, 'commissionPercentage' => 40, 'effectiveDate' => now()->toDateString()],
                'branches' => ['فرع المعادي', 'فرع مدينة نصر'],
            ],
            [
                'name' => 'الممرضة أماني',
                'email' => 'nurse.amani@alfath-clinic.com',
                'role' => 'NURSE',
                'specialty' => null,
                'consultation_fee' => null,
                'schedule' => null,
                'payroll' => ['model' => 'FIXED_SALARY', 'baseSalary' => 7000, 'effectiveDate' => now()->toDateString()],
                'branches' => ['فرع المعادي'],
            ],
            [
                'name' => 'موظفة الاستقبال منى',
                'email' => 'reception.mona@alfath-clinic.com',
                'role' => 'RECEPTIONIST',
                'specialty' => null,
                'consultation_fee' => null,
                'schedule' => null,
                'payroll' => ['model' => 'FIXED_SALARY', 'baseSalary' => 6000, 'effectiveDate' => now()->toDateString()],
                'branches' => ['فرع المعادي', 'فرع مدينة نصر'],
            ],
        ];

        foreach ($users as $userData) {
            $user = User::query()->updateOrCreate(
                ['email' => $userData['email']],
                [
                    'clinic_id' => $clinic->id,
                    'name' => $userData['name'],
                    'password' => 'password123',
                    'role' => $userData['role'],
                    'specialty' => $userData['specialty'],
                    'consultation_fee' => $userData['consultation_fee'],
                    'schedule' => $userData['schedule'],
                    'payroll' => $userData['payroll'],
                ]
            );

            if (Schema::hasTable('branch_user')) {
                foreach ($userData['branches'] as $branchName) {
                    $branch = $branches->get($branchName);

                    if (! $branch) {
                        continue;
                    }

                    DB::table('branch_user')->updateOrInsert(
                        [
                            'branch_id' => $branch->id,
                            'user_id' => $user->id,
                        ],
                        [
                            'clinic_id' => $clinic->id,
                            'updated_at' => now(),
                            'created_at' => now(),
                        ]
                    );
                }
            }

            if (Schema::hasTable('model_has_roles') && Schema::hasTable('roles')) {
                $roleId = DB::table('roles')
                    ->where('name', $userData['role'])
                    ->where('guard_name', 'web')
                    ->where('clinic_id', $clinic->id)
                    ->value('id');

                if ($roleId) {
                    DB::table('model_has_roles')->updateOrInsert(
                        [
                            'role_id' => $roleId,
                            'model_type' => User::class,
                            'model_id' => $user->id,
                            'clinic_id' => $clinic->id,
                        ],
                        []
                    );
                }
            }
        }
    }
}
