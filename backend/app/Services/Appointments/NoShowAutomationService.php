<?php

namespace App\Services\Appointments;

use App\Models\Appointment;
use App\Models\AppointmentNoShowRule;
use App\Models\AppointmentStatusAudit;
use App\Models\Clinic;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class NoShowAutomationService
{
    /**
     * @return array{processed:int,updated:int}
     */
    public function processClinic(int $clinicId, string $mode = 'time'): array
    {
        $clinic = Clinic::query()->findOrFail($clinicId);
        $timezone = data_get($clinic->settings, 'timezone', config('app.timezone', 'UTC'));
        $nowLocal = CarbonImmutable::now($timezone);

        $processed = 0;
        $updated = 0;

        Appointment::query()
            ->withoutGlobalScopes()
            ->where('clinic_id', $clinicId)
            ->whereIn('status', ['SCHEDULED', 'WAITING'])
            ->whereNull('started_at')
            ->whereNull('completed_at')
            ->whereNull('no_show_at')
            ->orderBy('id')
            ->chunkById(200, function ($appointments) use ($clinicId, $mode, $timezone, $nowLocal, &$processed, &$updated): void {
                foreach ($appointments as $appointment) {
                    $processed++;

                    if (! $this->isEligibleForNoShow($appointment, $clinicId, $mode, $timezone, $nowLocal)) {
                        continue;
                    }

                    if ($this->markAsNoShow($appointment, $mode, $nowLocal)) {
                        $updated++;
                    }
                }
            });

        return [
            'processed' => $processed,
            'updated' => $updated,
        ];
    }

    private function isEligibleForNoShow(Appointment $appointment, int $clinicId, string $mode, string $timezone, CarbonImmutable $nowLocal): bool
    {
        if (in_array($appointment->status, ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], true)) {
            return false;
        }

        $rule = $this->resolveRule($clinicId, $appointment->branch_id, $appointment->doctor?->specialty);

        if ($appointment->status === 'WAITING' && ! $rule['include_waiting']) {
            return false;
        }

        $scheduledDate = $appointment->date instanceof \DateTimeInterface ? $appointment->date->format('Y-m-d') : (string) $appointment->date;
        $scheduledAt = CarbonImmutable::parse($scheduledDate.' '.$appointment->time_slot, $timezone);

        if ($mode === 'eod') {
            $cutoffToday = CarbonImmutable::parse($nowLocal->toDateString().' '.$rule['end_of_day_cutoff_time'], $timezone);

            return $scheduledAt->toDateString() < $nowLocal->toDateString()
                || ($scheduledAt->toDateString() === $nowLocal->toDateString() && $nowLocal->greaterThanOrEqualTo($cutoffToday));
        }

        return $nowLocal->greaterThan($scheduledAt->addMinutes($rule['grace_minutes']));
    }

    /**
     * @return array{grace_minutes:int,include_waiting:bool,end_of_day_cutoff_time:string}
     */
    private function resolveRule(int $clinicId, int $branchId, ?string $specialty): array
    {
        $defaults = config('appointments.no_show.defaults');

        $rule = AppointmentNoShowRule::query()
            ->withoutGlobalScopes()
            ->where('clinic_id', $clinicId)
            ->where('is_active', true)
            ->where(function ($query) use ($branchId): void {
                $query->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->where(function ($query) use ($specialty): void {
                if ($specialty) {
                    $query->where('specialty', $specialty)->orWhereNull('specialty');

                    return;
                }

                $query->whereNull('specialty');
            })
            ->orderByRaw('CASE WHEN branch_id IS NULL THEN 0 ELSE 1 END DESC')
            ->orderByRaw('CASE WHEN specialty IS NULL THEN 0 ELSE 1 END DESC')
            ->first();

        return [
            'grace_minutes' => $rule?->grace_minutes ?? $defaults['grace_minutes'],
            'include_waiting' => $rule?->include_waiting ?? $defaults['include_waiting'],
            'end_of_day_cutoff_time' => $rule?->end_of_day_cutoff_time ?? $defaults['end_of_day_cutoff_time'],
        ];
    }

    private function markAsNoShow(Appointment $appointment, string $mode, CarbonImmutable $occurredAt): bool
    {
        return DB::transaction(function () use ($appointment, $mode, $occurredAt): bool {
            $updated = Appointment::query()
                ->withoutGlobalScopes()
                ->whereKey($appointment->id)
                ->whereIn('status', ['SCHEDULED', 'WAITING'])
                ->whereNull('started_at')
                ->whereNull('completed_at')
                ->whereNull('no_show_at')
                ->update([
                    'status' => 'NO_SHOW',
                    'no_show_at' => $occurredAt->utc(),
                    'updated_at' => now(),
                ]);

            if (! $updated) {
                return false;
            }

            AppointmentStatusAudit::query()->withoutGlobalScopes()->create([
                'clinic_id' => $appointment->clinic_id,
                'appointment_id' => $appointment->id,
                'from_status' => $appointment->status,
                'to_status' => 'NO_SHOW',
                'actor_type' => 'SYSTEM',
                'actor_id' => null,
                'action' => 'AUTO_NO_SHOW',
                'reason' => $mode === 'eod' ? 'END_OF_DAY' : 'GRACE_PERIOD_EXCEEDED',
                'metadata' => [
                    'source' => 'scheduler',
                    'mode' => $mode,
                ],
                'created_at' => now(),
            ]);

            return true;
        });
    }
}
