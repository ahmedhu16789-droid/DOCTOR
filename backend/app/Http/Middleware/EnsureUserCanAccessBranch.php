<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserCanAccessBranch
{
    public function handle(Request $request, Closure $next, string ...$branchKeys): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if (in_array((string) $user->role, ['ADMIN', 'HQ'], true)) {
            return $next($request);
        }

        $keys = count($branchKeys) > 0 ? $branchKeys : ['branchId', 'branch_id'];

        $requestedBranchIds = collect($keys)
            ->map(fn (string $key) => $request->input($key))
            ->filter(fn ($value) => $value !== null && $value !== '')
            ->flatten()
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values();

        if ($requestedBranchIds->isEmpty()) {
            return $next($request);
        }

        $allowedBranchIds = $user->branches()->pluck('branches.id')->map(fn ($id) => (int) $id);

        $hasUnauthorizedBranch = $requestedBranchIds
            ->diff($allowedBranchIds)
            ->isNotEmpty();

        abort_if($hasUnauthorizedBranch, 403, 'You are not assigned to the requested branch.');

        return $next($request);
    }
}
