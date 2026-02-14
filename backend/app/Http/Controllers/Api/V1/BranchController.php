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
        $branches = ApiCache::remember(
            'branches.index',
            $clinicId,
            'all',
            fn () => Branch::query()
                ->select(['id', 'clinic_id', 'name', 'location', 'contact_phone', 'is_active'])
                ->orderBy('id')
                ->get()
        );

        return BranchResource::collection($branches);
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
