<?php

namespace App\Http\Resources\Api\V1;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AppointmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $timezone = data_get($this->clinic?->settings, 'timezone', config('app.timezone', 'UTC'));
        $now = now()->timezone($timezone);
        $canViewAuditHistory = in_array((string) $request->user()?->role, ['FINANCE_ADMIN', 'ADMIN'], true);

        $scheduledStart = null;
        if ($this->date && $this->time_slot) {
            $formattedDate = \Carbon\Carbon::parse($this->date)->format('Y-m-d');
            $formattedTime = \Carbon\Carbon::parse($this->time_slot)->format('H:i');
            $scheduledStart = \Carbon\Carbon::parse("{$formattedDate} {$formattedTime}", $timezone);
        }

        $checkInAt = $this->check_in_at?->timezone($timezone);
        $startedAt = $this->started_at?->timezone($timezone);
        $completedAt = $this->completed_at?->timezone($timezone);

        $waitingFrom = $checkInAt ?? $scheduledStart;
        $waitingTo = $startedAt ?? $now;

        $waitingMinutes = $waitingFrom && $waitingTo && $waitingFrom->lte($waitingTo)
            ? $waitingFrom->diffInMinutes($waitingTo)
            : null;

        $serviceTo = $completedAt ?? $now;
        $serviceMinutes = $startedAt && $startedAt->lte($serviceTo)
            ? $startedAt->diffInMinutes($serviceTo)
            : null;

        $delayMinutes = $scheduledStart && $scheduledStart->lte($now) && ! in_array($this->status, ['COMPLETED', 'CANCELLED', 'NO_SHOW'], true)
            ? $scheduledStart->diffInMinutes($now)
            : null;


        $latestNotification = $this->notificationLogs->first();
        $notificationSummary = [
            'latestStatus' => $latestNotification?->status,
            'latestEvent' => $latestNotification?->event,
            'latestChannel' => $latestNotification?->channel,
            'latestRecipient' => $latestNotification?->recipient,
            'latestQueuedAt' => $latestNotification?->queued_at?->toIso8601String(),
            'latestSentAt' => $latestNotification?->sent_at?->toIso8601String(),
            'latestFailedAt' => $latestNotification?->failed_at?->toIso8601String(),
            'lastError' => $latestNotification?->error_message,
            'history' => $this->notificationLogs->take(5)->map(fn ($log) => [
                'id' => (string) $log->id,
                'event' => $log->event,
                'channel' => $log->channel,
                'status' => $log->status,
                'attempts' => (int) $log->attempts,
                'queuedAt' => $log->queued_at?->toIso8601String(),
                'sentAt' => $log->sent_at?->toIso8601String(),
                'failedAt' => $log->failed_at?->toIso8601String(),
                'errorMessage' => $log->error_message,
            ])->values(),
        ];

        return [
            'id' => (string) $this->id,
            'patientId' => (string) $this->patient_id,
            'doctorId' => (string) $this->doctor_id,
            'branchId' => (string) $this->branch_id,
            'doctorName' => $this->doctor?->name ?? 'Doctor',
            'date' => $this->date,
            'timeSlot' => $this->time_slot,
            'status' => $this->status,
            'scheduledStartAt' => $scheduledStart?->toIso8601String(),
            'checkInAt' => $checkInAt?->toIso8601String(),
            'calledAt' => $this->called_at?->timezone($timezone)?->toIso8601String(),
            'startedAt' => $startedAt?->toIso8601String(),
            'completedAt' => $completedAt?->toIso8601String(),
            'noShowAt' => $this->no_show_at?->timezone($timezone)?->toIso8601String(),
            'queueMetrics' => [
                'waitingMinutes' => $waitingMinutes,
                'serviceMinutes' => $serviceMinutes,
                'delayMinutes' => $delayMinutes,
            ],
            'billing' => [
                'total' => (float) ($this->invoice?->total ?? 0),
                'paidAmount' => (float) ($this->invoice?->paid_amount ?? 0),
                'status' => $this->invoice?->status ?? 'UNPAID',
                'lifecycleState' => $this->invoice?->lifecycle_state ?? 'DRAFT',
                'items' => $this->invoice?->items?->map(fn ($item) => [
                    'id' => (string) $item->id,
                    'serviceId' => $item->service_id,
                    'name' => $item->name,
                    'quantity' => (int) $item->quantity,
                    'unitPrice' => (float) $item->unit_price,
                    'total' => (float) $item->total,
                ])->values() ?? [],
                'transactions' => $this->invoice?->transactions?->map(fn ($transaction) => [
                    'id' => (string) $transaction->id,
                    'amount' => (float) $transaction->amount,
                    'method' => $transaction->method,
                    'timestamp' => optional($transaction->paid_at)->toIso8601String(),
                    'recordedBy' => 'system',
                    'reference' => data_get($transaction->metadata, 'original_transaction_reference'),
                    'type' => ((float) $transaction->amount) < 0 ? 'REFUND' : 'PAYMENT',
                    'metadata' => $transaction->metadata,
                ])->values() ?? [],
                'auditHistory' => $canViewAuditHistory
                    ? ($this->invoice?->auditLogs?->map(fn ($log) => [
                        'id' => (string) $log->id,
                        'actionType' => $log->action_type,
                        'targetEntityType' => $log->target_entity_type,
                        'targetEntityId' => $log->target_entity_id,
                        'beforeSnapshot' => $log->before_snapshot,
                        'afterSnapshot' => $log->after_snapshot,
                        'reason' => $log->reason,
                        'occurredAt' => optional($log->occurred_at)->toIso8601String(),
                        'actor' => [
                            'id' => (string) ($log->actor?->id ?? ''),
                            'name' => $log->actor?->name,
                        ],
                    ])->values() ?? [])
                    : [],
            ],
            'encounterStatus' => $this->encounter?->status,
            'notifications' => $notificationSummary,
        ];
    }
}
