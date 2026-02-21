<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\User;
use App\Support\ApiCache;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
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

        // Load branches without global scopes to ensure TenantScope doesn't filter them out
        // based on the potentially unauthenticated or partial context during login.
        $user = User::where('email', $validated['email'])
            ->with(['branches' => fn ($q) => $q->withoutGlobalScopes()])
            ->first();

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
                'examFindingTemplates' => $user->exam_finding_templates ?? [],
                'diagnosisTemplates' => $user->diagnosis_templates ?? [],
                'planTemplates' => $user->plan_templates ?? [],
            ],
            'clinicId' => (string) $user->clinic_id,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        
        // Ensure branches are loaded without global scopes
        if (!$user->relationLoaded('branches')) {
            $user->load(['branches' => fn ($q) => $q->withoutGlobalScopes()]);
        }

        $payload = ApiCache::remember(
            'auth.me',
            $user->clinic_id,
            (string) $user->id,
            fn () => [
                'user' => [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'assignedBranches' => $user->branches->pluck('id')->map(fn ($id) => (string) $id)->values()->all(),
                    'schedule' => $user->schedule ?? [],
                    'activeBranchId' => $this->resolveActiveBranchId($user),
                    'examFindingTemplates' => $user->exam_finding_templates ?? [],
                    'diagnosisTemplates' => $user->diagnosis_templates ?? [],
                    'planTemplates' => $user->plan_templates ?? [],
                ],
                'clinicId' => (string) $user->clinic_id,
            ]
        );

        return response()->json($payload);
    }

    private function resolveActiveBranchId(User $user): ?string
    {
        // Use clinic timezone for accurate shift detection
        $timezone = $user->clinic->settings['timezone'] ?? config('app.timezone');
        $now = Carbon::now($timezone);
        
        $dayOfWeek = $now->dayOfWeek;
        $currentTime = $now->format('H:i');
        $isDebug = (bool) config('app.debug');

        if ($isDebug) {
            Log::debug('Resolving active branch during auth.', [
                'user_id_masked' => $this->maskIdentifier((string) $user->id),
                'timezone' => $timezone,
                'day_of_week' => $dayOfWeek,
                'current_time' => $currentTime,
                'branch_count' => $user->branches->count(),
                'branch_ids_masked' => $user->branches
                    ->pluck('id')
                    ->map(fn ($id) => $this->maskIdentifier((string) $id))
                    ->values()
                    ->all(),
                'schedule_shift_count' => count($user->schedule ?? []),
            ]);
        }

        $activeShift = collect($user->schedule ?? [])->first(function (array $shift) use ($dayOfWeek, $currentTime, $isDebug): bool {
            $start = (string) ($shift['startTime'] ?? '00:00');
            $end = (string) ($shift['endTime'] ?? '00:00');
            $shiftDay = (int) ($shift['dayOfWeek'] ?? -1);

            $isActive = $shiftDay === $dayOfWeek
                && isset($shift['branchId'])
                && $start <= $currentTime
                && $currentTime <= $end;

            if ($isDebug) {
                Log::debug('Evaluated shift for active branch.', [
                    'shift_day' => $shiftDay,
                    'start' => $start,
                    'end' => $end,
                    'branch_id_masked' => isset($shift['branchId'])
                        ? $this->maskIdentifier((string) $shift['branchId'])
                        : null,
                    'is_active' => $isActive,
                ]);
            }

            return $isActive;
        });

        if (is_array($activeShift) && isset($activeShift['branchId'])) {
            if ($isDebug) {
                Log::debug('Resolved active branch from matching shift.', [
                    'branch_id_masked' => $this->maskIdentifier((string) $activeShift['branchId']),
                ]);
            }

            return (string) $activeShift['branchId'];
        }

        $firstAssignedBranch = $user->branches->pluck('id')->first();

        if ($isDebug) {
            Log::debug('Fallback to first assigned branch.', [
                'branch_id_masked' => $firstAssignedBranch
                    ? $this->maskIdentifier((string) $firstAssignedBranch)
                    : null,
            ]);
        }

        return $firstAssignedBranch ? (string) $firstAssignedBranch : null;
    }

    private function maskIdentifier(string $id): string
    {
        $length = strlen($id);

        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        return substr($id, 0, 2) . str_repeat('*', $length - 4) . substr($id, -2);
    }
}
