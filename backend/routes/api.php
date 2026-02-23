<?php

use App\Http\Controllers\Api\V1\AppointmentController;
use App\Http\Controllers\Api\V1\MedicationController;
use App\Http\Controllers\Api\V1\MedicalEncounterController;
use App\Http\Controllers\Api\V1\AppointmentBillingController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\CashSessionController;
use App\Http\Controllers\Api\V1\DirectoryController;
use App\Http\Controllers\Api\V1\DoctorController;
use App\Http\Controllers\Api\V1\DoctorAdvancedModeController;
use App\Http\Controllers\Api\V1\DoctorProfileController;
use App\Http\Controllers\Api\V1\DoctorPayrollController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\FinancialReportController;
use App\Http\Controllers\Api\V1\Auth\AccessLinkController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\PatientAuthController;
use App\Http\Controllers\Api\V1\ClinicSettingsController;
use App\Http\Controllers\Api\V1\ClinicEntitlementController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PatientPortalController;
use App\Http\Controllers\Api\V1\PublicBookingController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\Platform\ClinicController as PlatformClinicController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);
    Route::post('auth/access-links/consume', [AccessLinkController::class, 'consume']);

    Route::prefix('patient-portal/auth')->group(function (): void {
        Route::post('login', [PatientAuthController::class, 'login']);
    });

    Route::prefix('public/booking')->middleware('throttle:public-booking')->group(function (): void {
        Route::get('clinic-context', [PublicBookingController::class, 'clinicContext']);
        Route::get('available-slots', [PublicBookingController::class, 'availableSlots']);
        Route::post('', [PublicBookingController::class, 'store']);
    });


    Route::prefix('patient-portal')->middleware(['auth:sanctum', 'patient.auth'])->group(function (): void {
        Route::get('auth/me', [PatientAuthController::class, 'me']);
        Route::post('auth/logout', [PatientAuthController::class, 'logout']);

        Route::get('appointments/upcoming', [PatientPortalController::class, 'upcomingAppointments']);
        Route::post('appointments/{appointment}/reschedule', [PatientPortalController::class, 'reschedule']);
        Route::post('appointments/{appointment}/cancel', [PatientPortalController::class, 'cancel']);

        Route::get('visits', [PatientPortalController::class, 'visitHistory']);
        Route::get('visits/{encounter}/summary', [PatientPortalController::class, 'summary']);
        Route::get('visits/{encounter}/prescriptions', [PatientPortalController::class, 'prescriptions']);
        Route::get('prescriptions/{prescription}/download', [PatientPortalController::class, 'downloadPrescription']);
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/access-links', [AccessLinkController::class, 'create']);
        Route::get('patients', [PatientController::class, 'index']);
        Route::post('patients', [PatientController::class, 'store']);
        Route::get('patients/{patient}/audit-timeline', [PatientController::class, 'auditTimeline']);
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
        Route::get('doctor/advanced-mode/capabilities', [DoctorAdvancedModeController::class, 'capabilities']);
        Route::put('doctor/advanced-mode', [DoctorAdvancedModeController::class, 'toggle']);
        Route::get('employees', [EmployeeController::class, 'index']);
        Route::post('employees', [EmployeeController::class, 'store']);
        Route::put('employees/{employee}', [EmployeeController::class, 'update']);
        Route::get('appointments', [AppointmentController::class, 'index'])->middleware('branch.access:branchId');
        Route::get('appointments/available-slots', [AppointmentController::class, 'availableSlots']);
        Route::post('appointments/available-slots/bulk', [AppointmentController::class, 'availableSlotsBulk']);
        Route::post('appointments', [AppointmentController::class, 'store']);
        Route::get('appointments/delay-insight', [AppointmentController::class, 'delayInsight']);
        Route::post('appointments/shift/preview', [AppointmentController::class, 'delayShiftPreview']);
        Route::post('appointments/shift', [AppointmentController::class, 'bulkShift']);
        Route::post('appointments/{appointment}/reschedule', [AppointmentController::class, 'reschedule']);
        Route::patch('appointments/{appointment}/status', [AppointmentController::class, 'updateStatus']);
        Route::post('appointments/{appointment}/start-now', [AppointmentController::class, 'startNow']);

        Route::get('medications', [MedicationController::class, 'index']);
        Route::get('appointments/{appointment}/encounter', [MedicalEncounterController::class, 'show']);
        Route::put('appointments/{appointment}/encounter', [MedicalEncounterController::class, 'upsert']);
        Route::post('appointments/{appointment}/billing/items', [AppointmentBillingController::class, 'addItem']);
        Route::patch('appointments/{appointment}/billing/items/{item}', [AppointmentBillingController::class, 'updateItem']);
        Route::delete('appointments/{appointment}/billing/items/{item}', [AppointmentBillingController::class, 'removeItem'])
            ->middleware('permission.access:finance.remove_item,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');
        Route::post('appointments/{appointment}/billing/payments', [AppointmentBillingController::class, 'processPayment'])
            ->middleware('permission.access:finance.collect_payment,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER|RECEPTIONIST');
        Route::post('appointments/{appointment}/billing/refunds', [AppointmentBillingController::class, 'refund'])
            ->middleware('permission.access:finance.refund,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');
        Route::post('appointments/{appointment}/billing/finalize', [AppointmentBillingController::class, 'finalize']);
        Route::post('appointments/{appointment}/billing/reverse-finalization', [AppointmentBillingController::class, 'reverseFinalization']);
        Route::post('appointments/{appointment}/billing/void', [AppointmentBillingController::class, 'void']);
        Route::post('invoices/{invoice}/void', [AppointmentBillingController::class, 'voidInvoice']);
        Route::get('reports/dashboard', [DashboardController::class, 'index']);
        Route::post('cash-sessions/open', [CashSessionController::class, 'open'])->middleware('branch.access:branch_id,privilege:CASH_SESSION');
        Route::post('cash-sessions/{cashSession}/close', [CashSessionController::class, 'close']);
        Route::get('reports/reconciliation', [CashSessionController::class, 'report'])->middleware('branch.access:branch_id,privilege:CASH_SESSION');
        Route::get('reports/financial', [FinancialReportController::class, 'index'])
            ->middleware('permission.access:finance.view_reports,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');
        Route::get('reports/financial/export', [FinancialReportController::class, 'export'])
            ->middleware('permission.access:finance.view_reports,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');
        Route::get('reports/doctor-payroll', [DoctorPayrollController::class, 'index'])
            ->middleware('permission.access:finance.view_reports,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');
        Route::get('reports/doctor-payroll/export', [DoctorPayrollController::class, 'export'])
            ->middleware(['branch.access:branch_id,privilege:FINANCE', 'permission.access:finance.view_reports,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER']);
        Route::get('reports/doctor-payroll', [DoctorPayrollController::class, 'index'])
            ->middleware(['branch.access:branch_id,privilege:FINANCE', 'permission.access:finance.view_reports,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER']);
        Route::post('payroll/periods/{id}/close', [DoctorPayrollController::class, 'close'])
            ->middleware('permission.access:payroll.close,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');
        Route::post('payroll/periods/{id}/settle', [DoctorPayrollController::class, 'settle'])
            ->middleware('permission.access:payroll.settle,ADMIN|FINANCE_ADMIN|BRANCH_MANAGER');

        Route::prefix('platform')->middleware('platform.admin')->group(function (): void {
            Route::get('clinics', [PlatformClinicController::class, 'index']);
            Route::get('clinics/{id}', [PlatformClinicController::class, 'show']);
            Route::get('clinics/{id}/timeline', [PlatformClinicController::class, 'timeline']);
            Route::patch('clinics/{id}/status', [PlatformClinicController::class, 'updateStatus']);
            Route::post('clinics/{id}/payments', [PlatformClinicController::class, 'storePayment']);
        });

        Route::get('clinic/settings', [ClinicSettingsController::class, 'show']);
        Route::put('clinic/settings', [ClinicSettingsController::class, 'update']);
        Route::get('clinic/entitlements/usage', [ClinicEntitlementController::class, 'usage']);
    });
});
