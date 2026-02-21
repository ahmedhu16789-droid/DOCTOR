<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasPermission
{
    public function handle(Request $request, Closure $next, string $permission, string $fallbackRoles = ''): Response
    {
        $user = $request->user();
        abort_unless($user, 401);

        $allowedRoles = array_filter(array_map('trim', explode('|', $fallbackRoles)));

        $hasPermission = $user->hasPermissionTo($permission, 'web')
            || $this->roleHasPermission((int) $user->clinic_id, (string) $user->role, $permission)
            || in_array((string) $user->role, $allowedRoles, true);

        abort_unless($hasPermission, 403, 'You are not authorized to perform this action.');

        return $next($request);
    }

    private function roleHasPermission(int $clinicId, string $roleName, string $permission): bool
    {
        if ($clinicId <= 0 || $roleName === '') {
            return false;
        }

        return DB::table('roles')
            ->join('role_has_permissions', 'role_has_permissions.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'role_has_permissions.permission_id')
            ->where('roles.clinic_id', $clinicId)
            ->where('roles.name', $roleName)
            ->where('permissions.name', $permission)
            ->exists();
    }
}
