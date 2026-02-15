<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Medication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MedicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $query = Medication::query()->select(['id', 'name', 'active_ingredient', 'form', 'strength']);

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('active_ingredient', 'like', "%{$search}%");
            });
        }

        $medications = $query->orderBy('name')->limit(25)->get();

        return response()->json([
            'data' => $medications->map(fn (Medication $medication) => [
                'id' => (string) $medication->id,
                'name' => $medication->name,
                'activeIngredient' => $medication->active_ingredient,
                'form' => $medication->form,
                'strength' => $medication->strength,
            ])->values(),
        ]);
    }
}
