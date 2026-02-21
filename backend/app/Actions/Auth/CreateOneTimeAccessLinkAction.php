<?php

namespace App\Actions\Auth;

use App\Models\OneTimeAccessLink;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class CreateOneTimeAccessLinkAction
{
    /**
     * @return array{token: string, expiresAt: Carbon, email: string, userId: string}
     */
    public function execute(User $targetUser, User $actor): array
    {
        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);
        $now = Carbon::now();
        $expiresAt = $now->copy()->addHours(24);

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

        return [
            'token' => $token,
            'expiresAt' => $expiresAt,
            'userId' => (string) $targetUser->id,
            'email' => $targetUser->email,
        ];
    }
}
