<?php

namespace App\Services\Booking;

use App\Models\Appointment;
use App\Models\AppointmentSlotShift;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class DoctorScheduleService
{
    public function generateSlotsForDoctor(User $doctor, int $branchId, string $date): Collection
    {
        $dayOfWeek = Carbon::parse($date)->dayOfWeek;

        $baseSlots = collect($doctor->schedule ?? [])
            ->filter(function (array $shift) use ($branchId, $dayOfWeek): bool {
                return (string) ($shift['branchId'] ?? '') === (string) $branchId
                    && (int) ($shift['dayOfWeek'] ?? -1) === $dayOfWeek;
            })
            ->flatMap(function (array $shift): array {
                $duration = max(5, (int) ($shift['slotDuration'] ?? 20));
                $cursor = Carbon::createFromFormat('H:i', (string) ($shift['startTime'] ?? '09:00'));
                $end = Carbon::createFromFormat('H:i', (string) ($shift['endTime'] ?? '17:00'));

                $result = [];
                while ($cursor->lt($end)) {
                    $result[] = $cursor->format('H:i');
                    $cursor->addMinutes($duration);
                }

                return $result;
            })
            ->unique()
            ->sort()
            ->values();

        return $this->applyDailyShiftRules(
            slots: $baseSlots,
            clinicId: (int) $doctor->clinic_id,
            doctorId: (int) $doctor->id,
            branchId: $branchId,
            date: $date,
        );
    }

    private function applyDailyShiftRules(Collection $slots, int $clinicId, int $doctorId, int $branchId, string $date): Collection
    {
        $rules = AppointmentSlotShift::query()
            ->select(['from_time', 'shift_minutes'])
            ->where('clinic_id', $clinicId)
            ->where('doctor_id', $doctorId)
            ->where('branch_id', $branchId)
            ->whereDate('date', $date)
            ->orderBy('id')
            ->get();

        if ($rules->isEmpty()) {
            return $slots;
        }

        foreach ($rules as $rule) {
            $slots = $slots->map(function (string $time) use ($rule): string {
                if ($time < $rule->from_time) {
                    return $time;
                }

                return Carbon::createFromFormat('H:i', $time)
                    ->addMinutes((int) $rule->shift_minutes)
                    ->format('H:i');
            });
        }

        return $slots
            ->unique()
            ->sort()
            ->values();
    }

    public function loadBookedSlots(array $doctorIds, int $branchId, string $date, ?int $clinicId = null): array
    {
        if (empty($doctorIds)) {
            return [];
        }

        return Appointment::query()
            ->select(['doctor_id', 'time_slot'])
            ->whereIn('doctor_id', $doctorIds)
            ->where('branch_id', $branchId)
            ->when($clinicId, fn ($query) => $query->where('clinic_id', $clinicId))
            ->whereDate('date', $date)
            ->whereNotIn('status', ['CANCELLED', 'NO_SHOW'])
            ->get()
            ->groupBy('doctor_id')
            ->map(fn (Collection $group) => $group->pluck('time_slot')->all())
            ->all();
    }
}

