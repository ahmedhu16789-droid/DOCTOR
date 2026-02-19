<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\DoctorUpsertRequest;
use App\Http\Resources\Api\V1\DoctorResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DoctorController extends Controller
{
    public function index(Request $request)
    {
        $doctors = User::query()
            ->select(['id', 'clinic_id', 'name', 'email', 'phone', 'role', 'specialty', 'consultation_fee', 'schedule', 'payroll', 'exam_finding_templates', 'diagnosis_templates', 'plan_templates'])
            ->with(['branches:id'])
            ->where('role', 'DOCTOR')
            ->when($request->filled('name'), fn ($query) => $query->where('name', 'like', '%'.$request->string('name')->value().'%'))
            ->when($request->filled('specialty'), fn ($query) => $query->where('specialty', $request->string('specialty')->value()))
            ->when($request->filled('branchId'), fn ($query) => $query->whereHas('branches', fn ($q) => $q->where('branches.id', $request->integer('branchId'))))
            ->latest('id')
            ->simplePaginate(50);

        return DoctorResource::collection($doctors);
    }

    public function store(DoctorUpsertRequest $request)
    {
        $doctor = DB::transaction(function () use ($request): User {
            $doctor = User::create([
                'clinic_id' => $request->user()->clinic_id,
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value() ?: null,
                'password' => bcrypt('doctor12345'),
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
                'effective_from' => now()->toDateString(),
                'effective_to' => null,
                'is_active' => true,
            ]);

            $doctor->branches()->sync($this->branchPivotPayload($request));

            return $doctor->load('branches');
        });

        return response()->json(new DoctorResource($doctor), 201);
    }

    public function update(DoctorUpsertRequest $request, User $doctor)
    {
        abort_unless($doctor->role === 'DOCTOR', 404);

        $doctor = DB::transaction(function () use ($request, $doctor): User {
            $doctor->update([
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value() ?: null,
                'specialty' => $request->string('specialty')->value(),
                'consultation_fee' => $request->input('consultationFee'),
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
                'effective_from' => now()->toDateString(),
                'effective_to' => null,
                'is_active' => true,
            ]);

            $doctor->branches()->sync($this->branchPivotPayload($request));

            return $doctor->load('branches');
        });

        return response()->json(new DoctorResource($doctor));
    }

    private function branchPivotPayload(DoctorUpsertRequest $request): array
    {
        $clinicId = $request->user()->clinic_id;

        return collect($request->input('assignedBranches', []))
            ->mapWithKeys(fn ($branchId) => [(int) $branchId => ['clinic_id' => $clinicId]])
            ->all();
    }
}
