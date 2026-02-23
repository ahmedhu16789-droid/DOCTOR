<?php

namespace App\Actions\Billing;

use App\Models\Clinic;
use App\Services\Billing\ClinicEntitlementService;
use Illuminate\Http\Exceptions\HttpResponseException;

class EnsureClinicResourceLimitAction
{
    public const LIMIT_EXCEEDED_CODE = 'LIMIT_EXCEEDED';

    public function __construct(private readonly ClinicEntitlementService $clinicEntitlementService) {}

    public function execute(Clinic $clinic, string $resourceKey): void
    {
        $limitPayload = data_get($this->clinicEntitlementService->summary($clinic), "limits.{$resourceKey}");

        if (! is_array($limitPayload)) {
            return;
        }

        $isUnlimited = (bool) ($limitPayload['isUnlimited'] ?? true);
        $used = (int) ($limitPayload['used'] ?? 0);
        $limit = isset($limitPayload['limit']) ? (int) $limitPayload['limit'] : null;

        if ($isUnlimited || $limit === null || $used < $limit) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => 'Clinic subscription limit has been reached.',
            'code' => self::LIMIT_EXCEEDED_CODE,
            'resource' => $resourceKey,
        ], 422));
    }
}

