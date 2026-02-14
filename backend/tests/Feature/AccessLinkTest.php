<?php

namespace Tests\Feature;

use App\Models\Clinic;
use App\Models\OneTimeAccessLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccessLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_user_can_generate_one_time_access_link_and_revokes_previous_unused(): void
    {
        [$actor, $target] = $this->createUsersInSameClinic();

        Sanctum::actingAs($actor);

        $first = $this->postJson('/api/v1/auth/access-links', [
            'userId' => $target->id,
        ])->assertCreated()->json();

        $this->assertArrayHasKey('token', $first);

        $second = $this->postJson('/api/v1/auth/access-links', [
            'userId' => $target->id,
        ])->assertCreated()->json();

        $this->assertNotSame($first['token'], $second['token']);

        $links = OneTimeAccessLink::query()->where('user_id', $target->id)->orderBy('id')->get();
        $this->assertCount(2, $links);
        $this->assertNotNull($links->first()->revoked_at);
        $this->assertNull($links->last()->revoked_at);
        $this->assertNull($links->last()->used_at);
    }



    public function test_consume_is_rejected_when_email_does_not_match_link_owner(): void
    {
        [$actor, $target] = $this->createUsersInSameClinic();

        Sanctum::actingAs($actor);

        $payload = $this->postJson('/api/v1/auth/access-links', [
            'userId' => $target->id,
        ])->assertCreated()->json();

        $oldPasswordHash = $target->password;

        $this->postJson('/api/v1/auth/access-links/consume', [
            'token' => $payload['token'],
            'email' => 'another-user@example.com',
            'password' => 'newStrongPass123',
            'password_confirmation' => 'newStrongPass123',
        ])->assertStatus(422);

        $target->refresh();
        $this->assertSame($oldPasswordHash, $target->password);

        $link = OneTimeAccessLink::query()->where('user_id', $target->id)->latest('id')->firstOrFail();
        $this->assertNull($link->used_at);
    }

    public function test_user_can_consume_link_once_and_password_is_updated(): void
    {
        [$actor, $target] = $this->createUsersInSameClinic();

        Sanctum::actingAs($actor);

        $payload = $this->postJson('/api/v1/auth/access-links', [
            'userId' => $target->id,
        ])->assertCreated()->json();

        $this->postJson('/api/v1/auth/access-links/consume', [
            'token' => $payload['token'],
            'email' => $target->email,
            'password' => 'newStrongPass123',
            'password_confirmation' => 'newStrongPass123',
        ])->assertOk();

        $target->refresh();
        $this->assertTrue(Hash::check('newStrongPass123', $target->password));

        $link = OneTimeAccessLink::query()->where('user_id', $target->id)->latest('id')->firstOrFail();
        $this->assertNotNull($link->used_at);

        $this->postJson('/api/v1/auth/access-links/consume', [
            'token' => $payload['token'],
            'email' => $target->email,
            'password' => 'anotherPass123',
            'password_confirmation' => 'anotherPass123',
        ])->assertStatus(422);
    }

    /**
     * @return array{0: User, 1: User}
     */
    private function createUsersInSameClinic(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Test Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $actor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
            'password' => 'password123',
        ]);

        $target = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'password' => 'doctor12345',
        ]);

        return [$actor, $target];
    }
}
