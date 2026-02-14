<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'clinicName' => ['required', 'string', 'max:255'],
            'ownerName' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'settings.currency' => ['nullable', 'string', 'max:10'],
            'settings.timezone' => ['nullable', 'string', 'max:100'],
        ]);

        $payload = DB::transaction(function () use ($validated): array {
            $clinic = Clinic::create([
                'name' => $validated['clinicName'],
                'subscription_status' => 'trial',
                'settings' => [
                    'currency' => $validated['settings']['currency'] ?? 'USD',
                    'timezone' => $validated['settings']['timezone'] ?? 'UTC',
                ],
            ]);

            $user = User::create([
                'clinic_id' => $clinic->id,
                'name' => $validated['ownerName'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => 'ADMIN',
            ]);

            $role = Role::firstOrCreate(
                ['name' => 'ADMIN', 'guard_name' => 'web', 'clinic_id' => $clinic->id],
                ['clinic_id' => $clinic->id]
            );

            $user->assignRole($role);

            $token = $user->createToken('api-token')->plainTextToken;

            return ['clinic' => $clinic, 'user' => $user, 'token' => $token];
        });

        return response()->json([
            'token' => $payload['token'],
            'clinic' => [
                'id' => (string) $payload['clinic']->id,
                'name' => $payload['clinic']->name,
                'subscriptionStatus' => $payload['clinic']->subscription_status,
                'settings' => $payload['clinic']->settings,
            ],
            'user' => [
                'id' => (string) $payload['user']->id,
                'name' => $payload['user']->name,
                'email' => $payload['user']->email,
                'role' => $payload['user']->role,
            ],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->with('branches:id')->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 422);
        }

        $user->tokens()->delete();

        return response()->json([
            'token' => $user->createToken('api-token')->plainTextToken,
            'user' => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'assignedBranches' => $user->branches->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
                'schedule' => $user->schedule ?? [],
                'activeBranchId' => $this->resolveActiveBranchId($user),
            ],
            'clinicId' => (string) $user->clinic_id,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->loadMissing('branches:id');

        return response()->json([
            'user' => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'assignedBranches' => $user->branches->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
                'schedule' => $user->schedule ?? [],
                'activeBranchId' => $this->resolveActiveBranchId($user),
            ],
            'clinicId' => (string) $user->clinic_id,
        ]);
    }

    private function resolveActiveBranchId(User $user): ?string
    {
        $now = Carbon::now();
        $dayOfWeek = $now->dayOfWeek;
        $currentTime = $now->format('H:i');

        $activeShift = collect($user->schedule ?? [])->first(function (array $shift) use ($dayOfWeek, $currentTime): bool {
            $start = (string) ($shift['startTime'] ?? '00:00');
            $end = (string) ($shift['endTime'] ?? '00:00');

            return (int) ($shift['dayOfWeek'] ?? -1) === $dayOfWeek
                && isset($shift['branchId'])
                && $start <= $currentTime
                && $currentTime <= $end;
        });

        if (is_array($activeShift) && isset($activeShift['branchId'])) {
            return (string) $activeShift['branchId'];
        }

        $firstAssignedBranch = $user->branches->pluck('id')->first();

        return $firstAssignedBranch ? (string) $firstAssignedBranch : null;
    }
}
