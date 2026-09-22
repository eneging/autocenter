<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Project;
use App\Models\User;

trait ChecksOrderAccess
{
    protected function isAdmin(User $user): bool
    {
        return $user->hasRole('Administrador');
    }

    /** Un técnico solo puede tocar las órdenes que tiene asignadas; el administrador, todas. */
    protected function authorizeOrder(User $user, Project $project): void
    {
        if ($this->isAdmin($user)) {
            return;
        }

        $worker = $user->worker;

        if (! $worker || $project->responsible_worker_id !== $worker->id) {
            abort(403, 'Solo puedes gestionar las órdenes que tienes asignadas.');
        }
    }
}
