<?php

namespace App\Jobs;

use App\Services\Appointments\NoShowAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessClinicNoShowJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $clinicId,
        public string $mode = 'time',
    ) {
    }

    public function handle(NoShowAutomationService $service): void
    {
        $service->processClinic($this->clinicId, $this->mode);
    }
}
