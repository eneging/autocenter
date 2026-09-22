<?php

namespace Database\Seeders;

use App\Models\Expense;
use App\Models\Project;
use App\Models\Quotation;
use App\Models\QuotationPayment;
use App\Models\Worker;
use App\Models\WorkerPayment;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Seeder independiente solo para probar el modulo de Finanzas.
 * No toca usuarios, roles ni datos existentes — se puede correr en cualquier
 * momento sobre una base ya sembrada con el DatabaseSeeder principal:
 *
 *   php artisan db:seed --class=FinanceDemoSeeder
 */
class FinanceDemoSeeder extends Seeder
{
    public function run(): void
    {
        $projects = Project::all();
        $workers = Worker::where('is_active', true)->get();
        $quotations = Quotation::with('payments')->get();

        if ($quotations->isEmpty()) {
            $this->command?->warn('No hay cotizaciones todavia. Corre primero el DatabaseSeeder principal.');
            return;
        }

        $this->seedQuotationPayments($quotations);
        $this->seedExpenses($projects);
        $this->seedWorkerPayments($workers, $projects);

        $this->command?->info('Datos de prueba de Finanzas listos: pagos de cotizaciones, gastos y pagos a trabajadores.');
    }

    private function seedQuotationPayments($quotations): void
    {
        $methods = ['Efectivo', 'Yape', 'Transferencia', 'Deposito'];

        $quotations->values()->each(function (Quotation $quotation, int $index) use ($methods) {
            if ($quotation->payments->isNotEmpty()) {
                return;
            }

            $scenario = $index % 3;

            if ($scenario === 0) {
                // Cobrada por completo: adelanto + saldo en fechas distintas
                $advance = round((float) $quotation->total * 0.5, 2);
                QuotationPayment::create([
                    'quotation_id' => $quotation->id,
                    'amount' => $advance,
                    'paid_at' => Carbon::now()->subDays(20),
                    'method' => $methods[$index % count($methods)],
                    'notes' => 'Adelanto',
                ]);
                QuotationPayment::create([
                    'quotation_id' => $quotation->id,
                    'amount' => round((float) $quotation->total - $advance, 2),
                    'paid_at' => Carbon::now()->subDays(3),
                    'method' => $methods[($index + 1) % count($methods)],
                    'notes' => 'Saldo final',
                ]);
            } elseif ($scenario === 1) {
                // Solo adelanto: queda con saldo pendiente (cuentas por cobrar)
                QuotationPayment::create([
                    'quotation_id' => $quotation->id,
                    'amount' => round((float) $quotation->total * 0.4, 2),
                    'paid_at' => Carbon::now()->subDays(10),
                    'method' => $methods[$index % count($methods)],
                    'notes' => 'Adelanto',
                ]);
            }
            // scenario 2: sin pagos registrados todavia (pendiente de cobro)
        });
    }

    private function seedExpenses($projects): void
    {
        if (Expense::count() > 0) {
            $this->command?->info('Ya existen gastos, no se duplican.');
            return;
        }

        $expenses = [
            ['category' => 'Materiales', 'title' => 'Melamina y cantos', 'amount' => 850, 'method' => 'Efectivo', 'days_ago' => 3],
            ['category' => 'Materiales', 'title' => 'Bisagras y correderas', 'amount' => 320, 'method' => 'Yape', 'days_ago' => 8],
            ['category' => 'Materiales', 'title' => 'Tableros MDF', 'amount' => 610, 'method' => 'Transferencia', 'days_ago' => 35],
            ['category' => 'Herramientas', 'title' => 'Brocas y discos de corte', 'amount' => 180, 'method' => 'Efectivo', 'days_ago' => 12],
            ['category' => 'Herramientas', 'title' => 'Mantenimiento de sierra electrica', 'amount' => 250, 'method' => 'Transferencia', 'days_ago' => 40],
            ['category' => 'Alquiler', 'title' => 'Alquiler del taller', 'amount' => 1200, 'method' => 'Transferencia', 'days_ago' => 5],
            ['category' => 'Alquiler', 'title' => 'Alquiler del taller (mes pasado)', 'amount' => 1200, 'method' => 'Transferencia', 'days_ago' => 35],
            ['category' => 'Servicios', 'title' => 'Luz y agua del taller', 'amount' => 280, 'method' => 'Yape', 'days_ago' => 6],
            ['category' => 'Servicios', 'title' => 'Internet y telefono', 'amount' => 120, 'method' => 'Tarjeta', 'days_ago' => 15],
            ['category' => 'Transporte', 'title' => 'Flete de materiales', 'amount' => 150, 'method' => 'Efectivo', 'days_ago' => 9],
            ['category' => 'Transporte', 'title' => 'Combustible para entregas', 'amount' => 95, 'method' => 'Efectivo', 'days_ago' => 2],
            ['category' => 'Impuestos', 'title' => 'Pago SUNAT mensual', 'amount' => 210, 'method' => 'Transferencia', 'days_ago' => 18],
            ['category' => 'Otros', 'title' => 'Utiles de oficina', 'amount' => 60, 'method' => 'Efectivo', 'days_ago' => 22],
        ];

        foreach ($expenses as $data) {
            Expense::create([
                'project_id' => $projects->isNotEmpty() ? $projects->random()->id : null,
                'category' => $data['category'],
                'title' => $data['title'],
                'amount' => $data['amount'],
                'expense_date' => Carbon::now()->subDays($data['days_ago']),
                'method' => $data['method'],
            ]);
        }
    }

    private function seedWorkerPayments($workers, $projects): void
    {
        if (WorkerPayment::count() > 0) {
            $this->command?->info('Ya existen pagos a trabajadores, no se duplican.');
            return;
        }

        if ($workers->isEmpty()) {
            return;
        }

        foreach ($workers as $index => $worker) {
            $hours = 40 + $index * 12;
            $rate = (float) ($worker->hourly_rate ?? 15);

            WorkerPayment::create([
                'worker_id' => $worker->id,
                'project_id' => $projects->isNotEmpty() ? $projects->random()->id : null,
                'period_start' => Carbon::now()->subDays(14),
                'period_end' => Carbon::now()->subDays(7),
                'total_hours' => $hours,
                'hourly_rate' => $rate,
                'total_amount' => round($hours * $rate, 2),
                'paid_at' => Carbon::now()->subDays(5),
                'notes' => 'Pago quincenal',
            ]);
        }
    }
}
