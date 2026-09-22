<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class CreateAdminUser extends Command
{
    protected $signature = 'taller:create-admin {email : Correo del administrador} {--name= : Nombre visible} {--password= : Contraseña (si se omite, se pide por consola)}';

    protected $description = 'Crea (o actualiza) un usuario con rol Administrador';

    public function handle(): int
    {
        $email = strtolower(trim($this->argument('email')));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('El correo no es válido.');

            return self::FAILURE;
        }

        $password = $this->option('password') ?: $this->secret('Contraseña (mínimo 8 caracteres)');

        if (strlen((string) $password) < 8) {
            $this->error('La contraseña debe tener al menos 8 caracteres.');

            return self::FAILURE;
        }

        $role = Role::firstOrCreate(['name' => 'Administrador']);

        $user = User::firstOrNew(['email' => $email]);
        $existed = $user->exists;

        $user->fill([
            'name' => $this->option('name') ?: ($user->name ?: 'Administrador'),
            'is_active' => true,
        ]);
        $user->password = Hash::make($password);
        $user->save();
        $user->syncRoles([$role]);

        $this->info(($existed ? 'Administrador actualizado: ' : 'Administrador creado: ').$email);

        return self::SUCCESS;
    }
}
