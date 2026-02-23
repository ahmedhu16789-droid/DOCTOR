<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Billing\ClinicEntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClinicEntitlementController extends Controller
{
    public function __construct(private readonly ClinicEntitlementService $entitlementService)
    {
    }

    public function usage(Request $request): JsonResponse
    {
        $clinic = $request->user()->clinic;

        return response()->json([
            'data' => $this->entitlementService->summary($clinic),
        ]);
    }
}
