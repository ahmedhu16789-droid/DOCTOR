<?php

namespace App\Policies;

use App\Models\Appointment;
use App\Models\User;
use App\Services\DoctorAdvancedMode\DoctorAdvancedModeService;

class AppointmentPolicy
{
    public function __construct(private readonly DoctorAdvancedModeService $advancedModeService)
    {
    }

    public function reschedule(User $user, Appointment $appointment): bool
    {
        return $this->canManageAppointment($user, $appointment);
    }

    public function cancel(User $user, Appointment $appointment): bool
    {
        return $this->canManageAppointment($user, $appointment);
    }

    public function viewTimeline(User $user, int $doctorId, int $branchId): bool
    {
        if (in_array($user->role, ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'], true)) {
            return true;
        }

        return $user->role === 'DOCTOR'
            && (int) $user->id === $doctorId
            && $this->advancedModeService->isEnabledForBranch($user, $branchId);
    }

    public function applyShiftSuggestion(User $user, int $doctorId, int $branchId): bool
    {
        if (in_array($user->role, ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'], true)) {
            return true;
        }

        return $user->role === 'DOCTOR'
            && (int) $user->id === $doctorId
            && $this->advancedModeService->isEnabledForBranch($user, $branchId)
            && $this->advancedModeService->canApplyShiftSuggestions($user);
    }

    public function startNow(User $user, Appointment $appointment): bool
    {
        if (in_array($user->role, ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'], true)) {
            return true;
        }

        return $user->role === 'DOCTOR'
            && (int) $user->id === (int) $appointment->doctor_id
            && $this->advancedModeService->isEnabledForBranch($user, (int) $appointment->branch_id);
    }

    private function canManageAppointment(User $user, Appointment $appointment): bool
    {
        if (in_array($user->role, ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'], true)) {
            return true;
        }

        return $user->role === 'DOCTOR'
            && $this->advancedModeService->canDoctorOperateOwnAppointment($user, $appointment);
    }
}
