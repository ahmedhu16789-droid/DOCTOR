<?php

namespace App\Console\Commands;

use App\Jobs\ProcessClinicNoShowJob;
use App\Models\Clinic;
use Illuminate\Console\Command;

class DispatchAutoNoShowCommand extends Command
{
    protected $signature = 'appointments:no-show:dispatch {--clinic_id=} {--mode=time : time|eod}';

    protected $description = 'Dispatch queued jobs to process automatic NO_SHOW transitions';

    public function handle(): int
    {
        $mode = $this->option('mode');

        if (! in_array($mode, ['time', 'eod'], true)) {
            $this->error('Invalid --mode. Use time or eod.');

            return self::FAILURE;
        }

        $clinicIds = Clinic::query()
            ->when($this->option('clinic_id'), fn ($query, $clinicId) => $query->where('id', $clinicId))
            ->pluck('id');

        foreach ($clinicIds as $clinicId) {
            ProcessClinicNoShowJob::dispatch((int) $clinicId, $mode)->onQueue('default');
        }

        $this->info(sprintf('Dispatched %d no-show processing job(s) in %s mode.', $clinicIds->count(), $mode));

        return self::SUCCESS;
    }
}
