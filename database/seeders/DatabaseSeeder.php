<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * SEED_PROFILE=taller (por defecto): Calle Auto Center.
     * SEED_PROFILE=segmentos: datos de demostración del sistema original de Segmentos.
     */
    public function run(): void
    {
        $this->call(match (env('SEED_PROFILE', 'taller')) {
            'segmentos' => SegmentosDemoSeeder::class,
            default => TallerSeeder::class,
        });
    }
}
