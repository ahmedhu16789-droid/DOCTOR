<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class ApiCache
{
    public const TTL_SECONDS = 60;

    public static function remember(string $resource, int|string|null $clinicId, string $fingerprint, callable $resolver): mixed
    {
        $scope = self::scope($clinicId);
        $version = self::version($resource, $scope);
        $key = "api:{$resource}:{$scope}:v{$version}:{$fingerprint}";

        return Cache::remember($key, now()->addSeconds(self::TTL_SECONDS), $resolver);
    }

    public static function bump(string $resource, int|string|null $clinicId): void
    {
        $scope = self::scope($clinicId);
        $versionKey = self::versionKey($resource, $scope);

        Cache::increment($versionKey);
        Cache::put($versionKey, Cache::get($versionKey, 1), now()->addDay());
    }

    private static function version(string $resource, string $scope): int
    {
        return (int) Cache::remember(self::versionKey($resource, $scope), now()->addDay(), fn (): int => 1);
    }

    private static function versionKey(string $resource, string $scope): string
    {
        return "api:{$resource}:{$scope}:version";
    }

    private static function scope(int|string|null $clinicId): string
    {
        return $clinicId ? (string) $clinicId : 'global';
    }
}

