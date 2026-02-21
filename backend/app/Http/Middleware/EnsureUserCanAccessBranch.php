<?php

namespace App\Http\Middleware;

use App\Support\Authorization\ClinicBranchAuthorization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserCanAccessBranch
{
    public function __construct(private readonly ClinicBranchAuthorization $authorization)
    {
    }

    public function handle(Request $request, Closure $next, string ...$branchKeys): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        $privilege = 'READ';
        $keys = $branchKeys;

        if (count($branchKeys) > 0 && str_starts_with(end($branchKeys), 'privilege:')) {
            $privilege = strtoupper(str_replace('privilege:', '', (string) end($branchKeys)));
            $keys = array_slice($branchKeys, 0, -1);
        }

        $keys = count($keys) > 0 ? $keys : ['branchId', 'branch_id'];

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

        $this->authorization->assertBranchAccess($user, $requestedBranchIds->all(), $privilege);

        return $next($request);
    }
}
