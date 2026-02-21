<?php

namespace App\Http\Middleware;

use App\Models\Patient;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePatientAuthenticated
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() instanceof Patient) {
            return new JsonResponse(['message' => 'Patient authentication is required.'], 403);
        }

        return $next($request);
    }
}
