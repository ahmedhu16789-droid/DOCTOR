<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClinicSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $clinic = $request->user()->clinic;
        $settings = $clinic->settings ?? [];

        return response()->json([
            'data' => [
                'name' => $settings['name'] ?? $clinic->name,
                'email' => $settings['email'] ?? '',
                'phone' => $settings['phone'] ?? '',
                'website' => $settings['website'] ?? '',
                'timezone' => $settings['timezone'] ?? 'Africa/Cairo',
                'currency' => $settings['currency'] ?? 'EGP',
                'logoUrl' => $settings['logoUrl'] ?? '',
                'commission_basis' => $settings['commission_basis'] ?? 'PAID_AMOUNT',
                'apply_on_discounted_amount' => $settings['apply_on_discounted_amount'] ?? true,
                'include_tax' => $settings['include_tax'] ?? true,
                'clawback_on_refund' => $settings['clawback_on_refund'] ?? true,
                'accrual_day_of_month' => $settings['accrual_day_of_month'] ?? 1,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'website' => ['nullable', 'string', 'max:255'],
            'timezone' => ['required', 'string', 'max:64'],
            'currency' => ['required', 'string', 'size:3'],
            'logoUrl' => ['nullable', 'string', 'max:1000'],
            'commission_basis' => ['required', 'string', 'in:PAID_AMOUNT,INVOICE_TOTAL'],
            'apply_on_discounted_amount' => ['required', 'boolean'],
            'include_tax' => ['required', 'boolean'],
            'clawback_on_refund' => ['required', 'boolean'],
            'accrual_day_of_month' => ['required', 'integer', 'min:1', 'max:28'],
        ]);

        $clinic = $request->user()->clinic;
        $clinic->name = $validated['name'];
        $clinic->settings = [
            ...($clinic->settings ?? []),
            ...$validated,
        ];
        $clinic->save();

        return response()->json([
            'data' => $validated,
            'message' => 'Clinic settings saved successfully',
        ]);
    }
}
