<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (! Auth::check()) {
            return;
        }

        $clinicId = Auth::user()->clinic_id;

        if ($clinicId) {
            $builder->where($model->getTable().'.clinic_id', $clinicId);
        }
    }
}
