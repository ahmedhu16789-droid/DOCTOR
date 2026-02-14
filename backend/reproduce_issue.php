
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
if ($rawAssignments->count() > 0) {
    echo " - First Assignment Branch ID: " . $rawAssignments->first()->branch_id . "\n";
    
    // Check if the branch exists
    $branch = App\Models\Branch::find($rawAssignments->first()->branch_id);
    echo " - Branch Model Check: " . ($branch ? "Found: {$branch->name}" : "NOT FOUND") . "\n";
    
    // Check branch with raw DB
    $rawBranch = Illuminate\Support\Facades\DB::table('branches')->where('id', $rawAssignments->first()->branch_id)->first();
    echo " - Branch Raw DB Check: " . ($rawBranch ? "Found: {$rawBranch->name}" : "NOT FOUND") . "\n";
}

// Check Eloquent relationship STANDARD
$user->load('branches');
echo "Standard branches count: {$user->branches->count()}\n";

// Check Eloquent relationship WITHOUT GLOBAL SCOPES
$user->load(['branches' => fn($q) => $q->withoutGlobalScopes()]);
echo "Without Global Scopes branches count: {$user->branches->count()}\n";

// Debug Query
Illuminate\Support\Facades\DB::enableQueryLog();
$user->unsetRelation('branches');
$user->load('branches');
dump(Illuminate\Support\Facades\DB::getQueryLog());

