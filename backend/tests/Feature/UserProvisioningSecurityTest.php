<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Clinic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserProvisioningSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_doctor_is_not_authenticable_with_legacy_shared_password_and_gets_access_link(): void
    {
        [$actor, $branch] = $this->createActorAndBranch();

        Sanctum::actingAs($actor);

        $response = $this->postJson('/api/v1/doctors', [
            'name' => 'Dr Secure',
            'phone' => '01000000001',
            'email' => 'doctor-secure@example.com',
            'specialty' => 'Cardiology',
            'consultationFee' => 300,
            'assignedBranches' => [$branch->id],
            'payroll' => [
                'model' => 'FIXED_SALARY',
                'baseSalary' => 10000,
                'commissionPercentage' => null,
                'additionalServicesCommissionEnabled' => false,
                'additionalServicesCommissionPercentage' => null,
            ],
            'schedule' => [],
            'examFindingTemplates' => [],
            'diagnosisTemplates' => [],
            'planTemplates' => [],
        ])->assertCreated();

        $doctorId = (int) $response->json('doctor.data.id');
        $doctor = User::query()->findOrFail($doctorId);

        $this->assertFalse(Hash::check('doctor12345', $doctor->password));
        $this->assertNotNull($response->json('accessLink.token'));

        $this->assertDatabaseHas('one_time_access_links', [
            'user_id' => $doctor->id,
            'clinic_id' => $actor->clinic_id,
            'revoked_at' => null,
            'used_at' => null,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'doctor-secure@example.com',
            'password' => 'doctor12345',
        ])->assertStatus(422);
    }

    public function test_new_employee_is_not_authenticable_with_legacy_shared_password_and_gets_access_link(): void
    {
        [$actor, $branch] = $this->createActorAndBranch();

        Sanctum::actingAs($actor);

        $response = $this->postJson('/api/v1/employees', [
            'name' => 'Secure Employee',
            'phone' => '01000000002',
            'email' => 'employee-secure@example.com',
            'jobTitle' => 'Reception Specialist',
            'role' => 'RECEPTIONIST',
            'assignedBranches' => [$branch->id],
            'payroll' => [
                'model' => 'FIXED_SALARY',
                'baseSalary' => 7000,
                'commissionPercentage' => null,
            ],
            'schedule' => [],
        ])->assertCreated();

        $employeeId = (int) $response->json('employee.data.id');
        $employee = User::query()->findOrFail($employeeId);

        $this->assertFalse(Hash::check('employee12345', $employee->password));
        $this->assertNotNull($response->json('accessLink.token'));

        $this->assertDatabaseHas('one_time_access_links', [
            'user_id' => $employee->id,
            'clinic_id' => $actor->clinic_id,
            'revoked_at' => null,
            'used_at' => null,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'employee-secure@example.com',
            'password' => 'employee12345',
        ])->assertStatus(422);
    }

    /**
     * @return array{0: User, 1: Branch}
     */
    private function createActorAndBranch(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Security Test Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $actor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
            'password' => 'password123',
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Downtown',
            'contact_phone' => '01000000000',
            'is_active' => true,
        ]);

        return [$actor, $branch];
    }
}
