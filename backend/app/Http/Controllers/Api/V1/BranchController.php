<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BranchSettingsUpsertRequest;
use App\Http\Requests\Api\V1\BranchUpsertRequest;
use App\Http\Resources\Api\V1\BranchResource;
use App\Models\Branch;
use App\Support\ApiCache;
use App\Support\BranchSettingsResolver;
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
                    ->with('clinic:id,settings')
                    ->select(['id', 'clinic_id', 'name', 'location', 'contact_phone', 'is_active', 'settings'])
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
            'isActive' => (bool) (is_array($b) ? $b['is_active'] : $b->is_active),
            'settings' => BranchSettingsResolver::resolve(
                is_array($b) ? ($b['clinic']['settings'] ?? []) : ($b->clinic?->settings ?? []),
                is_array($b) ? ($b['settings'] ?? null) : $b->settings,
            ),
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
            'settings' => null,
        ]);

        $branch->load('clinic:id,settings');

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

        $branch->load('clinic:id,settings');

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

    public function showSettings(Branch $branch)
    {
        $branch->load('clinic:id,settings');

        return response()->json([
            'data' => BranchSettingsResolver::resolve($branch->clinic?->settings, $branch->settings),
        ]);
    }

    public function updateSettings(BranchSettingsUpsertRequest $request, Branch $branch)
    {
        $branch->update([
            'settings' => $request->validated(),
        ]);

        ApiCache::bump('branches.index', $request->user()->clinic_id);
        $branch->load('clinic:id,settings');

        return response()->json([
            'message' => 'Branch settings saved successfully',
            'data' => BranchSettingsResolver::resolve($branch->clinic?->settings, $branch->settings),
        ]);
    }

    public function resetSettings(Branch $branch)
    {
        $branch->update(['settings' => null]);

        ApiCache::bump('branches.index', auth()->user()?->clinic_id);
        $branch->load('clinic:id,settings');

        return response()->json([
            'message' => 'Branch settings reset to clinic defaults',
            'data' => BranchSettingsResolver::resolve($branch->clinic?->settings, $branch->settings),
        ]);
    }
}
