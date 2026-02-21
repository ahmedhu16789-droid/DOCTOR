<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Branch;
use App\Models\Clinic;
use App\Models\DoctorPayrollContract;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DoctorConsultationFeeSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_doctor_fee_updates_pending_public_booking_consultation_invoice_item(): void
    {
        [$admin, $doctor, $appointment, $invoice] = $this->createContext();

        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/doctors/{$doctor->id}", [
            'name' => $doctor->name,
            'phone' => $doctor->phone,
            'email' => $doctor->email,
            'specialty' => 'Cardiology',
            'consultationFee' => 600,
            'assignedBranches' => [$appointment->branch_id],
            'payroll' => [
                'model' => 'PERCENTAGE',
                'baseSalary' => 0,
                'commissionPercentage' => 20,
                'additionalServicesCommissionEnabled' => false,
                'additionalServicesCommissionPercentage' => null,
            ],
            'schedule' => [],
        ])->assertOk();

        $invoice->refresh();
        $item = InvoiceItem::query()->where('invoice_id', $invoice->id)->firstOrFail();

        $this->assertSame(600.0, (float) $item->unit_price);
        $this->assertSame(600.0, (float) $item->total);
        $this->assertSame(600.0, (float) $invoice->total);
    }

    public function test_updating_doctor_fee_does_not_change_manual_consultation_item_or_paid_invoice(): void
    {
        [$admin, $doctor, $appointment, $invoice] = $this->createContext();

        $manualInvoice = Invoice::query()->create([
            'clinic_id' => $doctor->clinic_id,
            'appointment_id' => $appointment->id,
            'total' => 500,
            'paid_amount' => 200,
            'status' => 'PARTIAL',
        ]);

        InvoiceItem::query()->create([
            'clinic_id' => $doctor->clinic_id,
            'invoice_id' => $manualInvoice->id,
            'service_id' => 'srv_cns',
            'name' => 'Consultation Fee',
            'category' => InvoiceItem::CATEGORY_CONSULTATION,
            'quantity' => 1,
            'unit_price' => 500,
            'total' => 500,
            'added_by' => $admin->id,
        ]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/doctors/{$doctor->id}", [
            'name' => $doctor->name,
            'phone' => $doctor->phone,
            'email' => $doctor->email,
            'specialty' => 'Cardiology',
            'consultationFee' => 700,
            'assignedBranches' => [$appointment->branch_id],
            'payroll' => [
                'model' => 'PERCENTAGE',
                'baseSalary' => 0,
                'commissionPercentage' => 20,
                'additionalServicesCommissionEnabled' => false,
                'additionalServicesCommissionPercentage' => null,
            ],
            'schedule' => [],
        ])->assertOk();

        $manualItem = InvoiceItem::query()->where('invoice_id', $manualInvoice->id)->firstOrFail();
        $manualInvoice->refresh();

        $this->assertSame(500.0, (float) $manualItem->unit_price);
        $this->assertSame(500.0, (float) $manualItem->total);
        $this->assertSame(500.0, (float) $manualInvoice->total);
    }

    /**
     * @return array{0: User, 1: User, 2: Appointment, 3: Invoice}
     */
    private function createContext(): array
    {
        $clinic = Clinic::query()->create([
            'name' => 'Fee Sync Clinic',
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

        $admin = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'ADMIN',
        ]);

        $doctor = User::factory()->create([
            'clinic_id' => $clinic->id,
            'role' => 'DOCTOR',
            'specialty' => 'Cardiology',
            'consultation_fee' => 500,
        ]);

        DoctorPayrollContract::query()->create([
            'clinic_id' => $clinic->id,
            'doctor_id' => $doctor->id,
            'model' => 'PERCENTAGE',
            'base_salary' => 0,
            'commission_percentage' => 20,
            'effective_from' => now()->toDateString(),
            'effective_to' => null,
            'is_active' => true,
        ]);

        $doctor->branches()->sync([$branch->id => ['clinic_id' => $clinic->id]]);

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
            'total' => 500,
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
            'unit_price' => 500,
            'total' => 500,
            'added_by' => null,
        ]);

        return [$admin, $doctor, $appointment, $invoice];
    }
}
