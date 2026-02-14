
$userEmail = 'manager.madi@alfath-clinic.com';
$user = App\Models\User::where('email', $userEmail)->first();

if (!$user) {
    echo "User not found: $userEmail\n";
    exit;
}

echo "User found: {$user->id}\n";
echo "Clinic ID: {$user->clinic_id}\n";

// Check raw DB for branch assignments
$rawAssignments = Illuminate\Support\Facades\DB::table('branch_user')->where('user_id', $user->id)->get();
echo "Raw assignments count: {$rawAssignments->count()}\n";
foreach ($rawAssignments as $assignment) {
    echo " - Branch ID: {$assignment->branch_id}, Clinic ID: {$assignment->clinic_id}\n";
}

// Check Eloquent relationship with :id optimization
$userWith optimized = App\Models\User::where('email', $userEmail)->with('branches:id')->first();
echo "Loaded branches with branches:id count: {$userWith->branches->count()}\n";
foreach ($userWith->branches as $branch) {
    echo " - Branch ID from model: {$branch->id}\n";
}

// Check Eloquent relationship WITHOUT optimization
$userFull = App\Models\User::where('email', $userEmail)->with('branches')->first();
echo "Loaded branches FULL count: {$userFull->branches->count()}\n";

// Simulate AuthController resolveActiveBranchId logic
$timezone = $user->clinic->settings['timezone'] ?? config('app.timezone');
$now = Carbon\Carbon::now($timezone);
echo "Timezone: $timezone, Now: $now\n";

$firstAssignedBranch = $userWith->branches->pluck('id')->first();
echo "First assigned branch (optimized): " . ($firstAssignedBranch ?? 'NULL') . "\n";

// Check TenantScope
echo "Auth::check(): " . (auth()->check() ? 'YES' : 'NO') . "\n";
if (auth()->check()) {
    echo "Auth User ID: " . auth()->id() . "\n";
}

// Simulate logged in context
auth()->login($user);
echo "Logged in as user. Auth::check(): " . (auth()->check() ? 'YES' : 'NO') . "\n";

$userLoggedIn = App\Models\User::where('email', $userEmail)->with('branches:id')->first();
echo "Loaded branches (Logged In) count: {$userLoggedIn->branches->count()}\n";

