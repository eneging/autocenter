<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

abstract class TallerTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (['Administrador', 'Trabajador', 'Cliente', 'Community Manager'] as $role) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web']);
        }
    }

    protected function admin(): User
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('Administrador');

        return $user;
    }

    /** @return array{0: User, 1: Worker} */
    protected function technician(string $name = 'Técnico Uno'): array
    {
        $user = User::factory()->create(['is_active' => true]);
        $user->assignRole('Trabajador');
        $worker = Worker::create(['user_id' => $user->id, 'name' => $name, 'role' => 'Técnico', 'hourly_rate' => 10]);

        return [$user, $worker];
    }

    protected function as(User $user): static
    {
        // El guard de Sanctum cachea al primer usuario resuelto; se limpia para poder cambiar de usuario en un mismo test.
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['*'], 'web');

        return $this;
    }

    protected function receptionPayload(array $overrides = []): array
    {
        return [
            'name' => 'Juan Pérez',
            'phone' => '987654321',
            'document_type' => '1',
            'document_number' => '12345678',
            'plate' => 'abc-123',
            'brand' => 'Toyota',
            'model' => 'Hilux',
            'problem_description' => 'No enciende por las mañanas',
            'service_type' => 'Mantenimiento eléctrico',
            'client_accepts_terms' => true,
            ...$overrides,
        ];
    }
}
