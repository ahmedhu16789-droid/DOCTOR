<?php

namespace App\Support\Authorization;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ClinicBranchAuthorization
{
    public function assertTenantOwnership(User $user, Model|int|string|null $resource): void
    {
        $resourceClinicId = $resource instanceof Model
            ? (int) data_get($resource, 'clinic_id')
            : (int) $resource;

        abort_unless($resourceClinicId > 0 && $resourceClinicId === (int) $user->clinic_id, 404);
    }

    /**
     * @param  array<int>  $branchIds
     */
    public function assertBranchAccess(User $user, array $branchIds, string $privilege = 'READ'): void
    {
        $normalizedBranchIds = collect($branchIds)
            ->filter(fn ($branchId) => $branchId !== null && $branchId !== '')
            ->map(fn ($branchId) => (int) $branchId)
            ->unique()
            ->values();

        if ($normalizedBranchIds->isEmpty()) {
            return;
        }

        $role = (string) $user->role;

        if (in_array($role, config('authorization.branch_membership_bypass_roles', []), true)) {
            return;
        }

        $allowedRolesForPrivilege = config(sprintf('authorization.branch_privileges.%s', strtoupper($privilege)), []);
        abort_unless(in_array($role, $allowedRolesForPrivilege, true), 403, 'Your role is not allowed to access this branch resource.');

        $allowedBranchIds = $user->branches()
            ->pluck('branches.id')
            ->map(fn ($branchId) => (int) $branchId)
            ->all();

        $hasUnauthorizedBranch = $normalizedBranchIds
            ->diff($allowedBranchIds)
            ->isNotEmpty();

        abort_if($hasUnauthorizedBranch, 403, 'You are not assigned to the requested branch.');
    }

    public function assertRole(User $user, array $allowedRoles, string $message = 'You are not authorized to perform this action.'): void
    {
        abort_unless(in_array((string) $user->role, $allowedRoles, true), 403, $message);
    }

    public function assertDoctorAssignedToBranch(bool $isAssigned): void
    {
        abort_if(! $isAssigned, 422, 'Doctor is not assigned to the selected branch.');
    }
}
