<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Billing\EnsureClinicResourceLimitAction;
use App\Actions\Auth\CreateOneTimeAccessLinkAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\EmployeeUpsertRequest;
use App\Http\Resources\Api\V1\EmployeeResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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

    public function store(EmployeeUpsertRequest $request, CreateOneTimeAccessLinkAction $createOneTimeAccessLink, EnsureClinicResourceLimitAction $ensureClinicResourceLimit)
    {
        $ensureClinicResourceLimit->execute($request->user()->clinic, 'max_staff');

        $payload = DB::transaction(function () use ($request, $createOneTimeAccessLink): array {
            $employee = User::create([
                'clinic_id' => $request->user()->clinic_id,
                'name' => $request->string('name')->value(),
                'email' => $request->string('email')->value() ?: null,
                'phone' => $request->string('phone')->value(),
                'password' => Hash::make(Str::random(40)),
                'role' => $request->string('role')->value(),
                'job_title' => $request->string('jobTitle')->value(),
                'schedule' => $request->input('schedule', []),
                'payroll' => $request->input('payroll'),
            ]);

            $employee->branches()->sync($this->branchPivotPayload($request));

            $employee->load('branches');

            $accessLink = null;

            if ($employee->email) {
                $accessLink = $createOneTimeAccessLink->execute($employee, $request->user());
            }

            return [
                'employee' => $employee,
                'accessLink' => $accessLink,
            ];
        });

        return response()->json([
            'employee' => new EmployeeResource($payload['employee']),
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

    public function destroy(Request $request, User $employee): \Illuminate\Http\JsonResponse
    {
        $validRoles = ['BRANCH_MANAGER', 'NURSE', 'RECEPTIONIST', 'PHARMACY_MANAGER'];
        abort_unless(in_array($employee->role, $validRoles, true), 404);
        abort_unless($employee->clinic_id === $request->user()->clinic_id, 403);

        DB::transaction(function () use ($employee): void {
            $employee->update(['is_active' => false]);
            $employee->tokens()->delete();
        });

        return response()->json(['message' => 'Employee deactivated successfully.']);
    }

    private function branchPivotPayload(EmployeeUpsertRequest $request): array
    {
        $clinicId = $request->user()->clinic_id;

        return collect($request->input('assignedBranches', []))
            ->mapWithKeys(fn ($branchId) => [(int) $branchId => ['clinic_id' => $clinicId]])
            ->all();
    }
}
