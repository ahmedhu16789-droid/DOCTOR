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
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinancialReportFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_consolidated_and_branch_filtered_financial_summary(): void
    {
        Carbon::setTestNow('2026-03-05 10:00:00');

        $clinic = Clinic::query()->create([
            'name' => 'Finance Clinic',
            'subscription_status' => 'trial',
            'settings' => ['timezone' => 'UTC', 'currency' => 'EGP'],
        ]);

        $branchA = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch A',
            'location' => 'Cairo',
            'contact_phone' => '01010000001',
            'is_active' => true,
        ]);

        $branchB = Branch::query()->create([
            'clinic_id' => $clinic->id,
            'name' => 'Branch B',
            'location' => 'Giza',
            'contact_phone' => '01010000002',
            'is_active' => true,
        ]);

        $admin = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
        ]);

        $appointmentA = $this->seedAppointmentWithInvoice($clinic->id, $branchA->id, $doctor->id, 100, 80);
        $appointmentB = $this->seedAppointmentWithInvoice($clinic->id, $branchB->id, $doctor->id, 200, 50);

        Transaction::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $appointmentA->invoice->id,
            'amount' => 80,
            'method' => 'CASH',
            'paid_at' => now(),
        ]);

        Transaction::query()->create([
            'clinic_id' => $clinic->id,
            'invoice_id' => $appointmentB->invoice->id,
            'amount' => 50,
            'method' => 'CARD',
            'paid_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/reports/financial')
            ->assertOk()
            ->assertJsonPath('data.summary.totalRevenue', 300.0)
            ->assertJsonPath('data.summary.cashCollected', 80.0)
            ->assertJsonPath('data.summary.outstandingRevenue', 170.0)
            ->assertJsonCount(2, 'data.branchRevenue')
            ->assertJsonCount(2, 'data.recentTransactions');

        $this->getJson('/api/v1/reports/financial?branch_id='.$branchA->id)
            ->assertOk()
            ->assertJsonPath('data.summary.totalRevenue', 100.0)
            ->assertJsonPath('data.summary.cashCollected', 80.0)
            ->assertJsonPath('data.summary.outstandingRevenue', 20.0)
            ->assertJsonCount(1, 'data.branchRevenue')
            ->assertJsonPath('data.branchRevenue.0.branchId', (string) $branchA->id)
            ->assertJsonCount(1, 'data.recentTransactions');
    }

    private function seedAppointmentWithInvoice(int $clinicId, int $branchId, int $doctorId, float $total, float $paidAmount): Appointment
    {
        $patient = Patient::query()->create([
            'clinic_id' => $clinicId,
            'name' => 'Patient '.$branchId,
            'phone' => '0105555'.str_pad((string) $branchId, 4, '0', STR_PAD_LEFT),
            'gender' => 'Male',
            'age' => 32,
        ]);

        $appointment = Appointment::query()->create([
            'clinic_id' => $clinicId,
            'branch_id' => $branchId,
            'patient_id' => $patient->id,
            'doctor_id' => $doctorId,
            'date' => now()->toDateString(),
            'time_slot' => '10:00',
            'status' => 'COMPLETED',
        ]);

        Invoice::query()->create([
            'clinic_id' => $clinicId,
            'appointment_id' => $appointment->id,
            'total' => $total,
            'paid_amount' => $paidAmount,
            'status' => $paidAmount >= $total ? 'PAID' : 'PARTIAL',
        ]);

        return $appointment->fresh(['invoice']);
    }
}
