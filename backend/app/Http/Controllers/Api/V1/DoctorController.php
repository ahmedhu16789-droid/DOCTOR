<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Billing\EnsureClinicResourceLimitAction;
use App\Http\Controllers\Controller;
use App\Actions\Auth\CreateOneTimeAccessLinkAction;
use App\Http\Requests\Api\V1\DoctorUpsertRequest;
use App\Http\Resources\Api\V1\DoctorResource;
use App\Models\DoctorService;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DoctorController extends Controller
{
    public function index(Request $request)
    {
        $doctors = User::query()
            ->select(['id', 'clinic_id', 'name', 'email', 'phone', 'role', 'specialty', 'consultation_fee', 'schedule', 'payroll', 'exam_finding_templates', 'diagnosis_templates', 'plan_templates'])
            ->with(['branches:id', 'doctorServices:id,doctor_id,name,price'])
            ->where('role', 'DOCTOR')
            ->when($request->filled('name'), fn ($query) => $query->where('name', 'like', '%'.$request->string('name')->value().'%'))
            ->when($request->filled('specialty'), fn ($query) => $query->where('specialty', $request->string('specialty')->value()))
            ->when($request->filled('branchId'), fn ($query) => $query->whereHas('branches', fn ($q) => $q->where('branches.id', $request->integer('branchId'))))
            ->latest('id')
            ->simplePaginate(50);

        return DoctorResource::collection($doctors);
    }

    public function store(DoctorUpsertRequest $request, CreateOneTimeAccessLinkAction $createOneTimeAccessLink, EnsureClinicResourceLimitAction $ensureClinicResourceLimit)
    {
        $ensureClinicResourceLimit->execute($request->user()->clinic, 'max_doctors');

        $payload = DB::transaction(function () use ($request, $createOneTimeAccessLink): array {
            $doctor = User::create([
                'clinic_id' => $request->user()->clinic_id,
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value() ?: null,
                'password' => Hash::make(Str::random(40)),
                'role' => 'DOCTOR',
                'specialty' => $request->string('specialty')->value(),
                'consultation_fee' => $request->input('consultationFee'),
                'schedule' => $request->input('schedule', []),
                'payroll' => $request->input('payroll'),
                'exam_finding_templates' => $request->input('examFindingTemplates', []),
                'diagnosis_templates' => $request->input('diagnosisTemplates', []),
                'plan_templates' => $request->input('planTemplates', []),
            ]);

            $doctor->payrollContracts()->create([
                'clinic_id' => $request->user()->clinic_id,
                'model' => $request->input('payroll.model'),
                'base_salary' => $request->input('payroll.baseSalary'),
                'commission_percentage' => $request->input('payroll.commissionPercentage'),
                'additional_services_commission_enabled' => (bool) $request->boolean('payroll.additionalServicesCommissionEnabled'),
                'additional_services_commission_percentage' => $request->input('payroll.additionalServicesCommissionPercentage'),
                'effective_from' => now()->toDateString(),
                'effective_to' => null,
                'is_active' => true,
            ]);

            $doctor->branches()->sync($this->branchPivotPayload($request));

            $doctor->load(['branches', 'doctorServices']);

            $this->syncDoctorServices($doctor, $request->input('services', []));
            $doctor->load(['branches', 'doctorServices']);

            $accessLink = null;

            if ($doctor->email) {
                $accessLink = $createOneTimeAccessLink->execute($doctor, $request->user());
            }

            return [
                'doctor' => $doctor,
                'accessLink' => $accessLink,
            ];
        });

        return response()->json([
            'doctor' => new DoctorResource($payload['doctor']),
            'accessLink' => $payload['accessLink']
                ? [
                    'token' => $payload['accessLink']['token'],
                    'expiresAt' => $payload['accessLink']['expiresAt']->toIso8601String(),
                    'userId' => $payload['accessLink']['userId'],
                    'email' => $payload['accessLink']['email'],
                ]
                : null,
        ], 201);
    }

    public function update(DoctorUpsertRequest $request, User $doctor)
    {
        abort_unless($doctor->role === 'DOCTOR', 404);

        $doctor = DB::transaction(function () use ($request, $doctor): User {
            $previousConsultationFee = (float) ($doctor->consultation_fee ?? 0);
            $newConsultationFee = (float) $request->input('consultationFee');

            $doctor->update([
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value() ?: null,
                'specialty' => $request->string('specialty')->value(),
                'consultation_fee' => $newConsultationFee,
                'schedule' => $request->input('schedule', []),
                'payroll' => $request->input('payroll'),
                'exam_finding_templates' => $request->input('examFindingTemplates', []),
                'diagnosis_templates' => $request->input('diagnosisTemplates', []),
                'plan_templates' => $request->input('planTemplates', []),
            ]);

            $doctor->payrollContracts()
                ->where('is_active', true)
                ->whereNull('effective_to')
                ->update([
                    'effective_to' => now()->toDateString(),
                    'is_active' => false,
                ]);

            $doctor->payrollContracts()->create([
                'clinic_id' => $request->user()->clinic_id,
                'model' => $request->input('payroll.model'),
                'base_salary' => $request->input('payroll.baseSalary'),
                'commission_percentage' => $request->input('payroll.commissionPercentage'),
                'additional_services_commission_enabled' => (bool) $request->boolean('payroll.additionalServicesCommissionEnabled'),
                'additional_services_commission_percentage' => $request->input('payroll.additionalServicesCommissionPercentage'),
                'effective_from' => now()->toDateString(),
                'effective_to' => null,
                'is_active' => true,
            ]);

            $doctor->branches()->sync($this->branchPivotPayload($request));
            $this->syncDoctorServices($doctor, $request->input('services', []));

            if ($previousConsultationFee !== $newConsultationFee) {
                $this->syncPendingPublicBookingConsultationFees($doctor, $newConsultationFee);
            }

            return $doctor->load(['branches', 'doctorServices']);
        });

        return response()->json(new DoctorResource($doctor));
    }

    public function destroy(Request $request, User $doctor): \Illuminate\Http\JsonResponse
    {
        abort_unless($doctor->role === 'DOCTOR', 404);
        abort_unless($doctor->clinic_id === $request->user()->clinic_id, 403);

        DB::transaction(function () use ($doctor): void {
            $doctor->update(['is_active' => false]);
            $doctor->tokens()->delete();
        });

        return response()->json(['message' => 'Doctor deactivated successfully.']);
    }

    private function branchPivotPayload(DoctorUpsertRequest $request): array
    {
        $clinicId = $request->user()->clinic_id;

        return collect($request->input('assignedBranches', []))
            ->mapWithKeys(fn ($branchId) => [(int) $branchId => ['clinic_id' => $clinicId]])
            ->all();
    }


    private function syncDoctorServices(User $doctor, array $services): void
    {
        $doctor->doctorServices()->delete();

        if (empty($services)) {
            return;
        }

        $payload = collect($services)
            ->map(fn (array $service): array => [
                'clinic_id' => $doctor->clinic_id,
                'doctor_id' => $doctor->id,
                'name' => trim((string) ($service['name'] ?? '')),
                'price' => (float) ($service['price'] ?? 0),
                'created_at' => now(),
                'updated_at' => now(),
            ])
            ->filter(fn (array $service): bool => $service['name'] !== '')
            ->values()
            ->all();

        if (empty($payload)) {
            return;
        }

        DoctorService::query()->insert($payload);
    }

    private function syncPendingPublicBookingConsultationFees(User $doctor, float $newConsultationFee): void
    {
        $invoiceIds = Invoice::query()
            ->where('clinic_id', $doctor->clinic_id)
            ->whereHas('appointment', fn ($query) => $query
                ->where('doctor_id', $doctor->id)
                ->whereIn('status', ['SCHEDULED', 'WAITING', 'CALLED', 'IN_PROGRESS']))
            ->whereHas('items', fn ($query) => $query
                ->where('service_id', 'srv_cns')
                ->where('category', InvoiceItem::CATEGORY_CONSULTATION)
                ->whereNull('added_by'))
            ->pluck('id');

        if ($invoiceIds->isEmpty()) {
            return;
        }

        InvoiceItem::query()
            ->whereIn('invoice_id', $invoiceIds)
            ->where('service_id', 'srv_cns')
            ->where('category', InvoiceItem::CATEGORY_CONSULTATION)
            ->whereNull('added_by')
            ->update([
                'unit_price' => $newConsultationFee,
                'total' => $newConsultationFee,
            ]);

        Invoice::query()
            ->whereIn('id', $invoiceIds)
            ->get()
            ->each(function (Invoice $invoice): void {
                $subtotal = (float) $invoice->items()->sum('total');
                $paidAmount = (float) $invoice->paid_amount;

                $invoice->forceFill([
                    'total' => $subtotal,
                    'status' => $paidAmount >= $subtotal ? 'PAID' : ($paidAmount > 0 ? 'PARTIAL' : 'UNPAID'),
                ])->save();
            });
    }
}
