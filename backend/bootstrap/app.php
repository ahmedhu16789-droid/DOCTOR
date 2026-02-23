<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\EnsurePatientAuthenticated;
use App\Http\Middleware\EnsureUserCanAccessBranch;
use App\Http\Middleware\EnsureUserHasPermission;
use App\Http\Middleware\EnsurePlatformAdmin;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'branch.access' => EnsureUserCanAccessBranch::class,
            'permission.access' => EnsureUserHasPermission::class,
            'patient.auth' => EnsurePatientAuthenticated::class,
            'platform.admin' => EnsurePlatformAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
