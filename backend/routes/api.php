<?php

use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\DirectoryController;
use App\Http\Controllers\Api\V1\DoctorController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\PatientController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::get('patients', [PatientController::class, 'index']);
        Route::get('branches', [BranchController::class, 'index']);
        Route::post('branches', [BranchController::class, 'store']);
        Route::put('branches/{branch}', [BranchController::class, 'update']);
        Route::delete('branches/{branch}', [BranchController::class, 'destroy']);
        Route::get('departments', [DirectoryController::class, 'departments']);
        Route::get('roles', [DirectoryController::class, 'roles']);
        Route::get('doctors', [DoctorController::class, 'index']);
        Route::post('doctors', [DoctorController::class, 'store']);
        Route::put('doctors/{doctor}', [DoctorController::class, 'update']);
        Route::get('employees', [EmployeeController::class, 'index']);
        Route::post('employees', [EmployeeController::class, 'store']);
        Route::put('employees/{employee}', [EmployeeController::class, 'update']);
        Route::get('appointments', [AppointmentController::class, 'index']);
        Route::post('appointments', [AppointmentController::class, 'store']);
    });
});
