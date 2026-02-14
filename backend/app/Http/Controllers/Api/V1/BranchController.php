<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BranchUpsertRequest;
use App\Http\Resources\Api\V1\BranchResource;
use App\Models\Branch;
use App\Support\ApiCache;
use Illuminate\Support\Facades\DB;

class BranchController extends Controller
{
    public function index()
    {
        $clinicId = auth()->user()?->clinic_id;

        // Use ApiCache to speed up subsequent requests.
        // We must cache the RESULT of the query (Collection), not the query builder itself.
        $branches = ApiCache::remember(
            'branches.index',
            $clinicId,
            'all',
            function () use ($clinicId) {
                return Branch::query()
                    ->withoutGlobalScopes()
                    ->where('clinic_id', $clinicId)
                    ->select(['id', 'clinic_id', 'name', 'location', 'contact_phone', 'is_active'])
                    ->orderBy('id')
                    ->get();
            }
        );
        
        // Return manual response to guarantee structure and keys match frontend expectations
        $data = $branches->map(fn($b) => [
            'id' => (string) $b->id,
            'name' => $b->name,
            'location' => $b->location,
            'contactPhone' => $b->contact_phone,
            'isActive' => (bool) (is_array($b) ? $b['is_active'] : $b->is_active), // Handle both array (if cached as array) and object
        ]);

        return response()->json(['data' => $data]);
    }

    public function store(BranchUpsertRequest $request)
    {
        $branch = Branch::create([
            'clinic_id' => $request->user()->clinic_id,
            'name' => $request->string('name')->value(),
            'location' => $request->string('location')->value(),
            'contact_phone' => $request->string('contactPhone')->value(),
            'is_active' => $request->boolean('isActive'),
        ]);

        ApiCache::bump('branches.index', $request->user()->clinic_id);

        return response()->json(new BranchResource($branch), 201);
    }

    public function update(BranchUpsertRequest $request, Branch $branch)
    {
        $branch->update([
            'name' => $request->string('name')->value(),
            'location' => $request->string('location')->value(),
            'contact_phone' => $request->string('contactPhone')->value(),
            'is_active' => $request->boolean('isActive'),
        ]);

        ApiCache::bump('branches.index', $request->user()->clinic_id);

        return response()->json(new BranchResource($branch));
    }

    public function destroy(Branch $branch)
    {
        DB::transaction(function () use ($branch): void {
            $branch->users()->detach();
            $branch->delete();
        });

        ApiCache::bump('branches.index', auth()->user()?->clinic_id);

        return response()->noContent();
    }
}
