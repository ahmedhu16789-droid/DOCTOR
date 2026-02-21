<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AppointmentMixedPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_accepts_mixed_cash_and_card_payments_in_single_request(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Mixed Payment Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branch = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Main Branch',
            'location' => 'Cairo',
            'contact_phone' => '01000000001',
            'is_active' => true,
        ]);

        $actor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
            'password' => 'password123',
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'password' => 'doctor12345',
        ]);

        $patient = Patient::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Patient One',
            'phone' => '01010000001',
            'gender' => 'Male',
            'age' => 29,
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinic->id,
            'branch_id' => $branch->id,
            'patient_id' => $patient->id,
            'doctor_id' => $doctor->id,
            'date' => now()->toDateString(),
            'time_slot' => '09:00',
            'status' => 'SCHEDULED',
        ]);

        $invoice = Invoice::query()->create([
            'clinic_id' => $clinic->id,
            'appointment_id' => $appointment->id,
            'total' => 150,
            'paid_amount' => 0,
            'status' => 'UNPAID',
        ]);

        Sanctum::actingAs($actor);

        $response = $this->postJson("/api/v1/appointments/{$appointment->id}/billing/payments", [
            'payments' => [
                ['amount' => 50, 'method' => 'CASH'],
                ['amount' => 100, 'method' => 'CARD'],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.billing.paidAmount', 150.0)
            ->assertJsonPath('data.billing.status', 'PAID')
            ->assertJsonCount(2, 'data.billing.transactions');

        $invoice->refresh();

        $this->assertSame(150.0, (float) $invoice->paid_amount);
        $this->assertSame('PAID', $invoice->status);
        $this->assertSame(2, Transaction::query()->where('invoice_id', $invoice->id)->count());
    }
}
