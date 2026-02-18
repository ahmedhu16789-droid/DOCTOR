<?php

use App\Models\Appointment;
use App\Models\User;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$appointments = Appointment::latest()->take(5)->with('doctor')->get();

echo "--- DEBUG APPOINTMENTS ---\n";
foreach ($appointments as $apt) {
    echo "ID: {$apt->id}, DoctorID: {$apt->doctor_id}, DoctorName: " . ($apt->doctor?->name ?? 'NULL') . "\n";
    
    // Check if user exists anyway
    $user = User::find($apt->doctor_id);
    echo "Direct User Query for ID {$apt->doctor_id}: " . ($user ? $user->name : 'NOT FOUND') . "\n";
    echo "------------------------\n";
}
