<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Models\OneTimeAccessLink;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AccessLinkController extends Controller
{
    public function create(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => ['required', 'integer', 'exists:users,id'],
        ]);

        $actor = $request->user();
        $targetUser = User::query()
            ->where('clinic_id', $actor->clinic_id)
            ->findOrFail($validated['userId']);

        if (! $targetUser->email) {
            return response()->json(['message' => 'Target user must have an email.'], 422);
        }

        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);
        $now = Carbon::now();
        $expiresAt = $now->copy()->addHours(24);

        DB::transaction(function () use ($targetUser, $actor, $now, $expiresAt, $tokenHash): void {
            OneTimeAccessLink::query()
                ->where('user_id', $targetUser->id)
                ->whereNull('used_at')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => $now]);

            OneTimeAccessLink::query()->create([
                'clinic_id' => $targetUser->clinic_id,
                'user_id' => $targetUser->id,
                'created_by' => $actor->id,
                'email' => mb_strtolower($targetUser->email),
                'token_hash' => $tokenHash,
                'expires_at' => $expiresAt,
            ]);
        });

        return response()->json([
            'token' => $token,
            'expiresAt' => $expiresAt->toIso8601String(),
            'userId' => (string) $targetUser->id,
            'email' => $targetUser->email,
        ], 201);
    }

    public function consume(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $tokenHash = hash('sha256', $validated['token']);
        $email = mb_strtolower($validated['email']);

        $link = OneTimeAccessLink::query()
            ->where('token_hash', $tokenHash)
            ->whereNull('used_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', Carbon::now())
            ->first();

        if (! $link) {
            return response()->json(['message' => 'This link is invalid or already used.'], 422);
        }

        if (mb_strtolower($link->email) !== $email) {
            return response()->json(['message' => 'Email does not match this link.'], 422);
        }

        $user = User::query()->find($link->user_id);

        if (! $user || mb_strtolower((string) $user->email) !== $email) {
            return response()->json(['message' => 'User no longer exists for this link.'], 422);
        }

        DB::transaction(function () use ($user, $validated, $link): void {
            $user->update([
                'password' => Hash::make($validated['password']),
            ]);
            $user->tokens()->delete();

            $link->update([
                'used_at' => Carbon::now(),
            ]);
        });

        return response()->json([
            'message' => 'Password has been set successfully.',
        ]);
    }
}
