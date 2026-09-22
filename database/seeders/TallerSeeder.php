<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\Promotion;
use App\Models\SiteService;
use App\Models\SiteSetting;
use App\Models\User;
use App\Models\Worker;
use App\Services\InventoryService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class TallerSeeder extends Seeder
{
    /**
     * Base de producción: roles, permisos, administrador y contenido inicial del sitio.
     * Con SEED_DEMO=true además carga técnicos, inventario y una promoción de ejemplo.
     *
     * Credenciales: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Si no se define contraseña,
     * se genera una aleatoria y se muestra una sola vez en consola.
     */
    public function run(): void
    {
        $permissions = collect([
            'manage users',
            'manage clients',
            'manage projects',
            'manage quotations',
            'view reports',
            'update assigned tasks',
            'upload project images',
            'view client portal',
        ])->map(fn (string $name) => Permission::firstOrCreate(['name' => $name]));

        $administrator = Role::firstOrCreate(['name' => 'Administrador']);
        $workerRole = Role::firstOrCreate(['name' => 'Trabajador']);
        $clientRole = Role::firstOrCreate(['name' => 'Cliente']);
        Role::firstOrCreate(['name' => 'Community Manager']);

        $administrator->syncPermissions($permissions);
        $workerRole->syncPermissions(['update assigned tasks', 'upload project images']);
        $clientRole->syncPermissions(['view client portal']);

        $this->seedAdmin($administrator);
        $this->seedSite();

        if (filter_var(env('SEED_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->seedDemo($workerRole);
        }
    }

    private function seedAdmin(Role $administrator): void
    {
        $email = env('SEED_ADMIN_EMAIL', 'admin@calleautocenter.pe');
        $password = env('SEED_ADMIN_PASSWORD');
        $generated = false;

        if (! $password) {
            $password = Str::password(16, symbols: false);
            $generated = true;
        }

        $admin = User::firstOrCreate(
            ['email' => $email],
            ['name' => 'Administrador', 'password' => Hash::make($password), 'is_active' => true],
        );

        $admin->assignRole($administrator);

        if ($admin->wasRecentlyCreated && $generated) {
            $this->command?->warn("Usuario administrador: {$email} / contraseña generada: {$password} (guárdala, no se vuelve a mostrar)");
        }
    }

    private function seedSite(): void
    {
        $settings = SiteSetting::current();

        // Solo se completan los campos vacíos: volver a sembrar no pisa lo que el admin ya editó.
        $defaults = [
            'company_name' => 'Calle Auto Center',
            'tagline' => 'Reparación y mantenimiento automotriz',
            'project_role' => 'Taller mecánico y eléctrico automotriz',
            'hero_title' => 'Tu vehículo en las mejores manos',
            'hero_subtitle' => 'Diagnóstico, reparación y mantenimiento eléctrico y mecánico, con seguimiento en tiempo real de tu vehículo desde tu celular.',
            'about_text' => 'Calle Auto Center es un taller especializado en reparación y mantenimiento de vehículos. Te mostramos el avance de tu servicio con fotos y notas del técnico, para que sepas en todo momento cómo va tu auto.',
            'social_embeds' => [
                ['platform' => 'Facebook', 'url' => ''],
                ['platform' => 'Instagram', 'url' => ''],
                ['platform' => 'TikTok', 'url' => ''],
            ],
        ];

        $settings->update(array_filter($defaults, fn ($value, $key) => blank($settings->{$key}), ARRAY_FILTER_USE_BOTH));

        if (SiteService::count() === 0) {
            collect([
                ['title' => 'Mantenimiento eléctrico', 'description' => 'Diagnóstico y reparación del sistema eléctrico: batería, alternador, arranque, luces y cableado.', 'sort_order' => 1],
                ['title' => 'Reparación mecánica', 'description' => 'Motor, frenos, suspensión, transmisión y todo lo que tu vehículo necesite.', 'sort_order' => 2],
                ['title' => 'Mantenimiento preventivo', 'description' => 'Cambio de aceite, filtros y revisión general para evitar fallas antes de que ocurran.', 'sort_order' => 3],
            ])->each(fn (array $service) => SiteService::create($service));
        }

        // El catálogo de precios lo carga el administrador (Sitio web → Catálogo y precios): no se siembran precios inventados.
    }

    private function seedDemo(Role $workerRole): void
    {
        $technicianUser = User::firstOrCreate(
            ['email' => 'tecnico@calleautocenter.pe'],
            ['name' => 'Técnico Demo', 'password' => Hash::make(Str::random(24)), 'is_active' => true],
        );
        $technicianUser->assignRole($workerRole);

        Worker::firstOrCreate(
            ['user_id' => $technicianUser->id],
            ['name' => 'Técnico Demo', 'role' => 'Técnico', 'phone' => '900000001', 'hourly_rate' => 12],
        );

        Client::firstOrCreate(
            ['document_number' => '12345678'],
            ['name' => 'Cliente Demo', 'document_type' => '1', 'document' => 'DNI 12345678', 'phone' => '900000002'],
        );

        $inventory = app(InventoryService::class);
        foreach ([
            ['Repuesto', 'BAT-12V', 'Batería 12V 45Ah', 8, 280, 350, true],
            ['Repuesto', 'ACE-10W40', 'Aceite 10W40 (litro)', 30, 28, 40, true],
            ['Repuesto', 'FIL-ACE', 'Filtro de aceite', 20, 15, 25, true],
            ['Herramienta', 'LLV-TORQ', 'Llave de torque', 2, 180, null, false],
        ] as [$type, $code, $name, $stock, $cost, $price, $includesIgv]) {
            $item = InventoryItem::firstOrCreate(['code' => $code], [
                'type' => $type,
                'name' => $name,
                'unit_cost' => $cost,
                'sale_price' => $price,
                'includes_igv' => $includesIgv,
                'min_stock' => 3,
                'qr_data' => $code,
                'stock' => 0,
            ]);

            if ($item->wasRecentlyCreated) {
                $inventory->move($item, 'Entrada', $stock, null, null, 'Stock inicial (demo)');
            }
        }

        Promotion::firstOrCreate(['title' => '10% de descuento en tu primer mantenimiento'], [
            'type' => 'cupon',
            'description' => 'Regístrate y recibe tu cupón de descuento para tu primer servicio.',
            'discount_percent' => 10,
            'coupon_prefix' => 'CAC',
            'is_active' => true,
        ]);
    }
}
