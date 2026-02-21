<?php

use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\MedicationController;
use App\Http\Controllers\Api\V1\MedicalEncounterController;
use App\Http\Controllers\Api\V1\AppointmentBillingController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\CashSessionController;
use App\Http\Controllers\Api\V1\DirectoryController;
use App\Http\Controllers\Api\V1\DoctorController;
use App\Http\Controllers\Api\V1\DoctorProfileController;
use App\Http\Controllers\Api\V1\DoctorPayrollController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\FinancialReportController;
use App\Http\Controllers\Api\V1\Auth\AccessLinkController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\ClinicSettingsController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PublicBookingController;
use App\Http\Controllers\Api\V1\DashboardController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/access-links/consume', [AccessLinkController::class, 'consume']);

    Route::prefix('public/booking')->middleware('throttle:public-booking')->group(function (): void {
        Route::get('clinic-context', [PublicBookingController::class, 'clinicContext']);
        Route::get('available-slots', [PublicBookingController::class, 'availableSlots']);
        Route::post('', [PublicBookingController::class, 'store']);
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/access-links', [AccessLinkController::class, 'create']);
        Route::get('patients', [PatientController::class, 'index']);
        Route::post('patients', [PatientController::class, 'store']);
        Route::get('branches', [BranchController::class, 'index']);
        Route::post('branches', [BranchController::class, 'store']);
        Route::put('branches/{branch}', [BranchController::class, 'update']);
        Route::get('branches/{branch}/settings', [BranchController::class, 'showSettings']);
        Route::put('branches/{branch}/settings', [BranchController::class, 'updateSettings']);
        Route::delete('branches/{branch}/settings', [BranchController::class, 'resetSettings']);
        Route::delete('branches/{branch}', [BranchController::class, 'destroy']);
        Route::get('departments', [DirectoryController::class, 'departments']);
        Route::get('roles', [DirectoryController::class, 'roles']);
        Route::get('doctors', [DoctorController::class, 'index']);
        Route::post('doctors', [DoctorController::class, 'store']);
        Route::put('doctors/{doctor}', [DoctorController::class, 'update']);
        Route::get('doctor-profile', [DoctorProfileController::class, 'show']);
        Route::put('doctor-profile', [DoctorProfileController::class, 'update']);
        Route::get('employees', [EmployeeController::class, 'index']);
        Route::post('employees', [EmployeeController::class, 'store']);
        Route::put('employees/{employee}', [EmployeeController::class, 'update']);
        Route::get('appointments', [AppointmentController::class, 'index'])->middleware('branch.access:branchId');
        Route::get('appointments/available-slots', [AppointmentController::class, 'availableSlots']);
        Route::post('appointments/available-slots/bulk', [AppointmentController::class, 'availableSlotsBulk']);
        Route::post('appointments', [AppointmentController::class, 'store']);
        Route::post('appointments/shift', [AppointmentController::class, 'bulkShift']);
        Route::post('appointments/{appointment}/reschedule', [AppointmentController::class, 'reschedule']);
        Route::patch('appointments/{appointment}/status', [AppointmentController::class, 'updateStatus']);
        Route::post('appointments/{appointment}/start-now', [AppointmentController::class, 'startNow']);

        Route::get('medications', [MedicationController::class, 'index']);
        Route::get('appointments/{appointment}/encounter', [MedicalEncounterController::class, 'show']);
        Route::put('appointments/{appointment}/encounter', [MedicalEncounterController::class, 'upsert']);
        Route::post('appointments/{appointment}/billing/items', [AppointmentBillingController::class, 'addItem']);
        Route::patch('appointments/{appointment}/billing/items/{item}', [AppointmentBillingController::class, 'updateItem']);
        Route::delete('appointments/{appointment}/billing/items/{item}', [AppointmentBillingController::class, 'removeItem']);
        Route::post('appointments/{appointment}/billing/payments', [AppointmentBillingController::class, 'processPayment']);
        Route::post('appointments/{appointment}/billing/refunds', [AppointmentBillingController::class, 'refund']);
        Route::post('appointments/{appointment}/billing/finalize', [AppointmentBillingController::class, 'finalize']);
        Route::post('appointments/{appointment}/billing/reverse-finalization', [AppointmentBillingController::class, 'reverseFinalization']);
        Route::post('appointments/{appointment}/billing/void', [AppointmentBillingController::class, 'void']);
        Route::post('invoices/{invoice}/void', [AppointmentBillingController::class, 'voidInvoice']);
        Route::get('reports/dashboard', [DashboardController::class, 'index']);
        Route::post('cash-sessions/open', [CashSessionController::class, 'open'])->middleware('branch.access:branch_id');
        Route::post('cash-sessions/{cashSession}/close', [CashSessionController::class, 'close']);
        Route::get('reports/reconciliation', [CashSessionController::class, 'report'])->middleware('branch.access:branch_id');
        Route::get('reports/financial', [FinancialReportController::class, 'index']);
        Route::get('reports/doctor-payroll', [DoctorPayrollController::class, 'index']);
        Route::post('payroll/periods/{id}/close', [DoctorPayrollController::class, 'close']);
        Route::post('payroll/periods/{id}/settle', [DoctorPayrollController::class, 'settle']);
        Route::get('clinic/settings', [ClinicSettingsController::class, 'show']);
        Route::put('clinic/settings', [ClinicSettingsController::class, 'update']);
    });
});
