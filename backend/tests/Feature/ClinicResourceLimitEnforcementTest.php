<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Clinic;
use App\Models\ClinicEntitlement;
use App\Models\ClinicSubscription;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClinicResourceLimitEnforcementTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_create_branch_when_branch_limit_reached(): void
    {
        [$actor, $clinic] = $this->createActorWithEntitlements([
            'max_branches' => 1,
            'max_doctors' => 10,
            'max_staff' => 10,
        ]);

        Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Existing Branch',
            'location' => 'Downtown',
            'contact_phone' => '01000000001',
            'is_active' => true,
        ]);

        Sanctum::actingAs($actor);

        $response = $this->postJson('/api/v1/branches', [
            'name' => 'Second Branch',
            'location' => 'New City',
            'contactPhone' => '01000000002',
            'isActive' => true,
        ]);

        $response
            ->assertStatus(422)
            ->assertJson([
                'code' => 'LIMIT_EXCEEDED',
                'resource' => 'max_branches',
            ]);
    }

    public function test_cannot_create_doctor_when_doctor_limit_reached(): void
    {
        [$actor, $clinic] = $this->createActorWithEntitlements([
            'max_branches' => 10,
            'max_doctors' => 0,
            'max_staff' => 10,
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Downtown',
            'contact_phone' => '01000000003',
            'is_active' => true,
        ]);

        Sanctum::actingAs($actor);

        $response = $this->postJson('/api/v1/doctors', [
            'name' => 'Dr Limit',
            'phone' => '01000000004',
            'email' => 'dr-limit@example.com',
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
        ]);

        $response
            ->assertStatus(422)
            ->assertJson([
                'code' => 'LIMIT_EXCEEDED',
                'resource' => 'max_doctors',
            ]);
    }

    /**
     * @param array{max_branches:int, max_doctors:int, max_staff:int} $limits
     * @return array{0: User, 1: Clinic}
     */
    private function createActorWithEntitlements(array $limits): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Limit Test Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $plan = Plan::query()->create([
            'code' => 'LIMIT-PLAN-'.$clinic->id,
            'name' => 'Limit Plan',
            'description' => 'Plan for limit checks',
            'default_limits' => [
                'max_branches' => 50,
                'max_doctors' => 50,
                'max_staff' => 50,
                'max_patients_per_month' => 1000,
            ],
            'is_active' => true,
        ]);

        $subscription = ClinicSubscription::query()->create([
            'clinic_id' => $clinic->id,
            'plan_id' => $plan->id,
            'subscription_type' => 'ANNUAL',
            'status' => 'active',
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addYear(),
        ]);

        ClinicEntitlement::query()->create([
            'clinic_id' => $clinic->id,
            'clinic_subscription_id' => $subscription->id,
            'max_branches' => $limits['max_branches'],
            'max_doctors' => $limits['max_doctors'],
            'max_staff' => $limits['max_staff'],
            'max_patients_per_month' => 1000,
        ]);

        $actor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
            'password' => 'password123',
        ]);

        return [$actor, $clinic];
    }
}
