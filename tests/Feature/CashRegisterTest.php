<?php

namespace Tests\Feature;

use App\Models\CashRegister;
use App\Models\Project;
use App\Models\Transaction;
use App\Services\CommissionService;

class CashRegisterTest extends TallerTestCase
{
    private function income(int $registerId, float $amount, string $method, array $extra = []): array
    {
        return [
            'type' => 'Ingreso', 'category' => 'Servicio', 'payment_method' => $method, 'amount' => $amount, ...$extra,
        ];
    }

    public function test_only_one_register_can_be_open_and_current_returns_it(): void
    {
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/cash-registers/current')->assertOk()->assertJson([]);
        $this->as($admin)->postJson('/api/v1/cash-registers', ['opening_amount' => 50])->assertCreated()->assertJsonPath('status', 'Abierta');
        $this->as($admin)->postJson('/api/v1/cash-registers', [])->assertStatus(422);
        $this->as($admin)->getJson('/api/v1/cash-registers/current')->assertOk()->assertJsonPath('opening_amount', '50.00');
    }

    public function test_income_is_segmented_by_payment_method_and_igv_is_18_percent_contained(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/cash-registers', ['opening_amount' => 100])->json('id');

        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", $this->income($id, 118, 'Yape', ['is_taxable' => true]))
            ->assertCreated()->assertJsonPath('igv_amount', '18.00');
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", $this->income($id, 200, 'Efectivo'))->assertCreated();
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", $this->income($id, 50, 'Transferencia'))->assertCreated();
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", [
            'type' => 'Gasto Fijo', 'category' => 'Luz', 'payment_method' => 'Efectivo', 'amount' => 30,
        ])->assertCreated();
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", [
            'type' => 'Gasto Variable', 'category' => 'Gasolina', 'amount' => 20,
        ])->assertCreated();

        $summary = $this->as($admin)->getJson("/api/v1/cash-registers/{$id}")->assertOk()->json('summary');

        $this->assertSame(['Yape' => 118, 'Efectivo' => 200, 'Transferencia' => 50], $summary['income_by_method']);
        $this->assertEquals(368, $summary['income_total']);
        $this->assertEquals(30, $summary['fixed_expenses_total']);
        $this->assertEquals(20, $summary['variable_expenses_total']);
        $this->assertEquals(318, $summary['net_result']);
        $this->assertEquals(18, $summary['igv_income']);
        $this->assertEquals(270, $summary['expected_cash']); // 100 apertura + 200 efectivo - 30 gasto en efectivo
    }

    public function test_closing_stores_total_income_and_blocks_further_changes(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/cash-registers', [])->json('id');
        $tx = $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", $this->income($id, 80, 'Yape'))->json('id');

        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/close")->assertOk()->assertJsonPath('status', 'Cerrada')->assertJsonPath('total_income', '80.00');

        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/close")->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", $this->income($id, 10, 'Yape'))->assertStatus(422);
        $this->as($admin)->deleteJson("/api/v1/transactions/{$tx}")->assertStatus(422);

        $this->as($admin)->postJson('/api/v1/cash-registers', [])->assertCreated();
    }

    public function test_income_requires_payment_method_and_category_must_match_type(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/cash-registers', [])->json('id');

        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", ['type' => 'Ingreso', 'category' => 'Servicio', 'amount' => 10])->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", ['type' => 'Gasto Fijo', 'category' => 'Gasolina', 'amount' => 10])->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", ['type' => 'Gasto Fijo', 'category' => 'Luz', 'amount' => 0])->assertStatus(422);
    }

    public function test_commission_tiers(): void
    {
        $service = new CommissionService;

        $this->assertSame(0.0, $service->forAmount(999.99));
        $this->assertSame(100.0, $service->forAmount(1000));
        $this->assertSame(100.0, $service->forAmount(1499.99));
        $this->assertSame(200.0, $service->forAmount(1500));
        $this->assertSame(200.0, $service->forAmount(2500));
    }

    public function test_commissions_are_computed_per_technician_from_income_linked_to_their_orders_and_can_be_paid(): void
    {
        $admin = $this->admin();
        [, $worker] = $this->technician();
        $orderId = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload(['responsible_worker_id' => $worker->id]))->json('id');
        $registerId = $this->as($admin)->postJson('/api/v1/cash-registers', [])->json('id');

        $this->as($admin)->postJson("/api/v1/cash-registers/{$registerId}/transactions", $this->income($registerId, 1200, 'Efectivo', ['project_id' => $orderId]))->assertCreated();

        $rows = $this->as($admin)->getJson('/api/v1/commissions?from='.today()->startOfMonth()->toDateString().'&to='.today()->endOfMonth()->toDateString())
            ->assertOk()->json('rows');
        $this->assertSame($worker->id, $rows[0]['worker_id']);
        $this->assertEquals(1200, $rows[0]['generated']);
        $this->assertEquals(100, $rows[0]['commission']);

        $this->as($admin)->postJson('/api/v1/commissions/pay', [
            'worker_id' => $worker->id, 'from' => today()->startOfMonth()->toDateString(), 'to' => today()->endOfMonth()->toDateString(), 'payment_method' => 'Efectivo',
        ])->assertCreated();

        $this->assertDatabaseHas('transactions', ['category' => 'Comisiones', 'type' => 'Gasto Fijo', 'worker_id' => $worker->id]);
        $this->assertSame(1, Transaction::where('category', 'Comisiones')->count());
        $this->assertNotNull(Project::find($orderId));
        $this->assertNotNull(CashRegister::find($registerId));
    }

    public function test_technician_cannot_use_the_cash_register(): void
    {
        [$techUser] = $this->technician();

        $this->as($techUser)->getJson('/api/v1/cash-registers/current')->assertForbidden();
        $this->as($techUser)->postJson('/api/v1/cash-registers', [])->assertForbidden();
    }
}
