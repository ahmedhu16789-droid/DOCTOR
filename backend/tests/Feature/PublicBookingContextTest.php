<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Clinic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicBookingContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_booking_context_uses_public_uuid_and_minimized_payload(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Public Clinic',
            'subscription_status' => 'trial',
            'settings' => [
                'name' => 'Public Clinic Display Name',
                'phone' => '01000000000',
                'workingHours' => '9-5',
            ],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Cairo',
            'contact_phone' => '01011111111',
            'is_active' => true,
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'specialty' => 'CARDIOLOGY',
        ]);

        $doctor->branches()->attach($branch->id, ['clinic_id' => $clinic->id]);

        $response = $this->getJson('/api/v1/public/booking/clinic-context?clinicPublicId='.$clinic->public_uuid)
            ->assertOk();

        $response
            ->assertJsonPath('data.clinic.id', $clinic->public_uuid)
            ->assertJsonPath('data.clinic.name', 'Public Clinic Display Name')
            ->assertJsonPath('data.branches.0.name', 'Main Branch')
            ->assertJsonPath('data.doctors.0.id', $doctor->id)
            ->assertJsonPath('data.doctors.0.branchIds.0', $branch->id);

        $this->assertArrayNotHasKey('contact_phone', $response->json('data.branches.0'));
        $this->assertArrayNotHasKey('consultationFee', $response->json('data.doctors.0'));
        $this->assertArrayHasKey('address', $response->json('data.clinic'));
    }
}
