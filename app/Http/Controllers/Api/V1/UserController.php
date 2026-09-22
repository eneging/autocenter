<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::with(['worker', 'client'])->latest()->get()->map(fn (User $user) => $this->present($user));

        $orphanWorkers = Worker::whereNull('user_id')->latest()->get()->map(fn (Worker $worker) => $this->presentOrphanWorker($worker));

        return response()->json($users->concat($orphanWorkers)->values());
    }

    public function grantWorkerAccess(Worker $worker, Request $request): JsonResponse
    {
        if ($worker->user_id) {
            abort(422, 'Este trabajador ya tiene una cuenta de acceso.');
        }

        $data = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = DB::transaction(function () use ($worker, $data) {
            $user = User::create([
                'name' => $worker->name,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);
            $user->assignRole('Trabajador');
            $worker->update(['user_id' => $user->id]);

            return $user;
        });

        return response()->json($this->present($user->fresh(['worker', 'client'])), 201);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', Rule::in(['Administrador', 'Trabajador', 'Cliente', 'Community Manager'])],
            'phone' => ['nullable', 'string', 'max:40'],
            'worker_role' => ['nullable', 'string', 'max:100'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'document' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);
            $user->assignRole($data['role']);

            if ($data['role'] === 'Trabajador') {
                Worker::create([
                    'user_id' => $user->id,
                    'name' => $data['name'],
                    'role' => $data['worker_role'] ?? 'Produccion',
                    'phone' => $data['phone'] ?? null,
                    'hourly_rate' => $data['hourly_rate'] ?? 0,
                ]);
            } elseif ($data['role'] === 'Cliente') {
                Client::create([
                    'user_id' => $user->id,
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'document' => $data['document'] ?? null,
                    'address' => $data['address'] ?? null,
                    'company' => $data['company'] ?? null,
                ]);
            }

            return $user;
        });

        return response()->json($this->present($user->fresh(['worker', 'client'])), 201);
    }

    public function update(User $user, Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'is_active' => ['required', 'boolean'],
            'role' => ['nullable', Rule::in(['Administrador', 'Trabajador', 'Cliente', 'Community Manager'])],
            'worker_role' => ['nullable', 'string', 'max:100'],
            'hourly_rate' => ['nullable', 'numeric', 'min:0'],
            'phone' => ['nullable', 'string', 'max:40'],
            'document' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
        ]);

        $this->guardLastAdmin($user, $request, (bool) $data['is_active']);

        if (! empty($data['role']) && $data['role'] !== 'Administrador' && $user->hasRole('Administrador')) {
            $this->guardLastAdminRoleRemoval($user);
        }

        DB::transaction(function () use ($user, $data) {
            $user->update([
                'name' => $data['name'],
                'email' => $data['email'],
                'is_active' => $data['is_active'],
                ...(! empty($data['password']) ? ['password' => Hash::make($data['password'])] : []),
            ]);

            if (! empty($data['role'])) {
                $user->syncRoles([$data['role']]);

                if ($data['role'] === 'Trabajador' && ! $user->worker) {
                    Worker::create([
                        'user_id' => $user->id,
                        'name' => $data['name'],
                        'role' => $data['worker_role'] ?? 'Produccion',
                        'phone' => $data['phone'] ?? null,
                        'hourly_rate' => $data['hourly_rate'] ?? 0,
                    ]);
                }

                if ($data['role'] === 'Cliente' && ! $user->client) {
                    Client::create([
                        'user_id' => $user->id,
                        'name' => $data['name'],
                        'email' => $data['email'],
                        'phone' => $data['phone'] ?? null,
                        'document' => $data['document'] ?? null,
                        'address' => $data['address'] ?? null,
                        'company' => $data['company'] ?? null,
                    ]);
                }
            }

            $user->refresh();

            if ($user->worker) {
                $user->worker->update([
                    'name' => $data['name'],
                    'role' => $data['worker_role'] ?? $user->worker->role,
                    'phone' => $data['phone'] ?? $user->worker->phone,
                    'hourly_rate' => $data['hourly_rate'] ?? $user->worker->hourly_rate,
                ]);
            }

            if ($user->client) {
                $user->client->update([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? $user->client->phone,
                    'document' => $data['document'] ?? $user->client->document,
                    'address' => $data['address'] ?? $user->client->address,
                    'company' => $data['company'] ?? $user->client->company,
                ]);
            }
        });

        return response()->json($this->present($user->fresh(['worker', 'client'])));
    }

    public function deactivate(User $user, Request $request): JsonResponse
    {
        $this->guardLastAdmin($user, $request, false);

        $user->update(['is_active' => false]);

        return response()->json($this->present($user->fresh(['worker', 'client'])));
    }

    public function destroy(User $user, Request $request): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            abort(422, 'No puedes eliminar tu propia cuenta.');
        }

        if ($user->hasRole('Administrador') && User::role('Administrador')->count() <= 1) {
            abort(422, 'Debe quedar al menos un Administrador en el sistema.');
        }

        DB::transaction(function () use ($user) {
            $user->roles()->detach();
            $user->delete();
        });

        return response()->json(status: 204);
    }

    private function guardLastAdmin(User $user, Request $request, bool $willBeActive): void
    {
        if ($willBeActive) {
            return;
        }

        if ($user->id === $request->user()->id) {
            abort(422, 'No puedes desactivar tu propia cuenta.');
        }

        if ($user->hasRole('Administrador') && User::role('Administrador')->where('is_active', true)->count() <= 1) {
            abort(422, 'Debe quedar al menos un Administrador activo.');
        }
    }

    private function guardLastAdminRoleRemoval(User $user): void
    {
        if (User::role('Administrador')->count() <= 1) {
            abort(422, 'Debe quedar al menos un Administrador en el sistema.');
        }
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'roles' => $user->getRoleNames(),
            'worker' => $user->worker,
            'client' => $user->client,
            'has_login' => true,
        ];
    }

    private function presentOrphanWorker(Worker $worker): array
    {
        return [
            'id' => null,
            'name' => $worker->name,
            'email' => null,
            'is_active' => $worker->is_active,
            'roles' => ['Trabajador'],
            'worker' => $worker,
            'client' => null,
            'has_login' => false,
        ];
    }
}
