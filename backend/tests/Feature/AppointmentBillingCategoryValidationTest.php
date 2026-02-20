<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AppointmentBillingCategoryValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_invalid_or_missing_category_is_rejected_and_not_counted_in_appointment_total(): void
    {
        $clinic = Clinic::query()->create([
            'name' => 'Validation Clinic',
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
            'total' => 100,
            'paid_amount' => 0,
            'status' => 'UNPAID',
        ]);

        InvoiceItem::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $invoice->id,
            'service_id' => 'srv_cns',
            'name' => 'Consultation Fee',
            'category' => InvoiceItem::CATEGORY_CONSULTATION,
            'quantity' => 1,
            'unit_price' => 100,
            'total' => 100,
            'added_by' => $actor->id,
        ]);

        Sanctum::actingAs($actor);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/items", [
            'name' => 'Invalid Category Item',
            'category' => 'CUSTOM_CATEGORY',
            'quantity' => 1,
            'unitPrice' => 50,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['category']);

        $this->postJson("/api/v1/appointments/{$appointment->id}/billing/items", [
            'name' => 'Missing Category Item',
            'quantity' => 1,
            'unitPrice' => 50,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['category']);

        $invoice->refresh();

        $this->assertSame(100.0, (float) $invoice->total);
        $this->assertSame(1, InvoiceItem::query()->where('invoice_id', $invoice->id)->count());
    }
}
