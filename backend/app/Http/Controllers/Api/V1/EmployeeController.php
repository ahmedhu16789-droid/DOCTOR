<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\EmployeeUpsertRequest;
use App\Http\Resources\Api\V1\EmployeeResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $employees = User::query()
            ->select(['id', 'clinic_id', 'name', 'email', 'phone', 'role', 'job_title', 'schedule', 'payroll'])
            ->with(['branches:id,name,location,contact_phone,is_active'])
            ->whereIn('role', ['BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST', 'PHARMACY_MANAGER'])
            ->when($request->filled('name'), fn ($query) => $query->where('name', 'like', '%'.$request->string('name')->value().'%'))
            ->when($request->filled('role'), fn ($query) => $query->where('role', $request->string('role')->value()))
            ->when($request->filled('branchId'), fn ($query) => $query->whereHas('branches', fn ($q) => $q->where('branches.id', $request->integer('branchId'))))
            ->latest('id')
            ->simplePaginate(50);

        return EmployeeResource::collection($employees);
    }

    public function store(EmployeeUpsertRequest $request)
    {
        $employee = DB::transaction(function () use ($request): User {
            $employee = User::create([
                'clinic_id' => $request->user()->clinic_id,
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value(),
                'password' => bcrypt('employee12345'),
                'role' => $request->string('role')->value(),
                'job_title' => $request->string('jobTitle')->value(),
                'schedule' => $request->input('schedule', []),
                'payroll' => $request->input('payroll'),
            ]);

            $employee->branches()->sync($this->branchPivotPayload($request));

            return $employee->load('branches');
        });

        return response()->json(new EmployeeResource($employee), 201);
    }

    public function update(EmployeeUpsertRequest $request, User $employee)
    {
        abort_unless(in_array($employee->role, ['BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST', 'PHARMACY_MANAGER'], true), 404);

        $employee = DB::transaction(function () use ($request, $employee): User {
            $employee->update([
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value(),
                'role' => $request->string('role')->value(),
                'job_title' => $request->string('jobTitle')->value(),
                'schedule' => $request->input('schedule', []),
                'payroll' => $request->input('payroll'),
            ]);

            $employee->branches()->sync($this->branchPivotPayload($request));

            return $employee->load('branches');
        });

        return response()->json(new EmployeeResource($employee));
    }

    private function branchPivotPayload(EmployeeUpsertRequest $request): array
    {
        $clinicId = $request->user()->clinic_id;

        return collect($request->input('assignedBranches', []))
            ->mapWithKeys(fn ($branchId) => [(int) $branchId => ['clinic_id' => $clinicId]])
            ->all();
    }
}
