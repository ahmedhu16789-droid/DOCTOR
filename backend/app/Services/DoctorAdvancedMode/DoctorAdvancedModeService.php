<?php

namespace App\Services\DoctorAdvancedMode;

use App\Models\Appointment;
use App\Models\User;

class DoctorAdvancedModeService
{
    public function isEnabledForBranch(User $doctor, ?int $branchId = null): bool
    {
        if ($doctor->role !== 'DOCTOR') {
            return false;
        }

        if (! $branchId) {
            return (bool) $doctor->doctor_advanced_mode_enabled;
        }

        $branchPivot = $doctor->branches()
            ->where('branches.id', $branchId)
            ->first()?->pivot;

        $branchOverride = $branchPivot?->doctor_advanced_mode_enabled;

        if ($branchOverride !== null) {
            return (bool) $branchOverride;
        }

        return (bool) $doctor->doctor_advanced_mode_enabled;
    }

    public function capabilitiesForDoctor(User $doctor, ?int $branchId = null): array
    {
        $enabled = $this->isEnabledForBranch($doctor, $branchId);

        return [
            'advancedModeEnabled' => $enabled,
            'branchId' => $branchId ? (string) $branchId : null,
            'canRescheduleOwnSameDayAppointments' => $enabled,
            'canCancelOwnSameDayAppointments' => $enabled,
            'canViewDayTimelineAndDelays' => $enabled,
            'canApplyShiftSuggestions' => $enabled && $this->canApplyShiftSuggestions($doctor),
        ];
    }

    public function canDoctorOperateOwnAppointment(User $doctor, Appointment $appointment): bool
    {
        if (! $this->isEnabledForBranch($doctor, (int) $appointment->branch_id)) {
            return false;
        }

        if ((int) $appointment->doctor_id !== (int) $doctor->id) {
            return false;
        }

        if ($appointment->date?->toDateString() !== now()->toDateString()) {
            return false;
        }

        return true;
    }

    public function canApplyShiftSuggestions(User $user): bool
    {
        if ($user->role !== 'DOCTOR') {
            return in_array($user->role, ['ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'], true);
        }

        $permissionNames = $user->getAllPermissions()->pluck('name')->all();

        return in_array('appointments.shift.apply', $permissionNames, true)
            || in_array('appointments.shift.manage', $permissionNames, true)
            || in_array('appointments.manage', $permissionNames, true);
    }
}
