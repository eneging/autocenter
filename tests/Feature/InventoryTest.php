<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\PartsRequest;
use App\Models\Project;

class InventoryTest extends TallerTestCase
{
    private function item(array $overrides = []): InventoryItem
    {
        return InventoryItem::create([
            'type' => 'Repuesto',
            'code' => 'BAT-12V',
            'name' => 'Batería 12V',
            'stock' => 5,
            'unit_cost' => 100,
            'sale_price' => 118,
            'includes_igv' => true,
            'qr_data' => 'BAT-12V',
            ...$overrides,
        ]);
    }

    public function test_igv_is_extracted_when_price_includes_it_and_added_when_it_does_not(): void
    {
        $with = $this->item();
        $this->assertSame(['base' => 100.0, 'igv' => 18.0, 'total' => 118.0], $with->price_breakdown);

        $without = $this->item(['code' => 'X', 'qr_data' => 'X', 'includes_igv' => false, 'sale_price' => 100]);
        $this->assertSame(['base' => 100.0, 'igv' => 18.0, 'total' => 118.0], $without->price_breakdown);
    }

    public function test_create_item_with_initial_stock_records_a_movement_and_defaults_qr_to_code(): void
    {
        $response = $this->as($this->admin())->postJson('/api/v1/inventory', [
            'type' => 'Repuesto', 'code' => 'FIL-01', 'name' => 'Filtro', 'stock' => 10, 'unit_cost' => 15,
        ])->assertCreated();

        $response->assertJsonPath('stock', 10)->assertJsonPath('qr_data', 'FIL-01');
        $this->assertDatabaseHas('inventory_movements', ['type' => 'Entrada', 'quantity' => 10, 'stock_after' => 10]);
    }

    public function test_costs_are_editable_but_stock_only_changes_through_movements(): void
    {
        $item = $this->item();

        $this->as($this->admin())->putJson("/api/v1/inventory/{$item->id}", [
            'type' => 'Repuesto', 'code' => 'BAT-12V', 'name' => 'Batería 12V', 'stock' => 999, 'unit_cost' => 130, 'sale_price' => 150, 'qr_data' => 'BAT-12V',
        ])->assertOk()->assertJsonPath('unit_cost', '130.00')->assertJsonPath('stock', 5);
    }

    public function test_scan_identifies_by_qr_json_code_and_manual_name_then_commits_movements(): void
    {
        $item = $this->item();
        $admin = $this->admin();

        $qr = json_encode(['code' => 'BAT-12V', 'name' => 'Batería 12V']);
        $this->as($admin)->postJson('/api/v1/inventory/scan', ['payload' => $qr])->assertOk()->assertJsonPath('item.id', $item->id);
        $this->as($admin)->postJson('/api/v1/inventory/scan', ['payload' => 'BAT-12V'])->assertOk()->assertJsonPath('found', true);
        $this->as($admin)->postJson('/api/v1/inventory/scan', ['payload' => 'batería'])->assertOk()->assertJsonPath('item.id', $item->id);

        $this->as($admin)->postJson('/api/v1/inventory/scan', ['payload' => 'BAT-12V', 'action' => 'Salida', 'quantity' => 2, 'commit' => true])->assertOk();
        $this->assertSame(3, $item->fresh()->stock);

        $this->as($admin)->postJson('/api/v1/inventory/scan', ['payload' => 'BAT-12V', 'action' => 'Salida', 'quantity' => 9, 'commit' => true])->assertStatus(422);
        $this->assertSame(3, $item->fresh()->stock);

        $this->as($admin)->postJson('/api/v1/inventory/scan', ['payload' => 'NO-EXISTE'])->assertNotFound();
    }

    public function test_entry_scan_of_unknown_qr_with_full_data_creates_the_item(): void
    {
        $qr = json_encode(['code' => 'ACE-5W30', 'name' => 'Aceite 5W30', 'type' => 'Repuesto', 'unit_cost' => 35.5]);

        $this->as($this->admin())->postJson('/api/v1/inventory/scan', ['payload' => $qr, 'action' => 'Entrada', 'quantity' => 12, 'commit' => true])
            ->assertOk()->assertJsonPath('item.stock', 12)->assertJsonPath('item.name', 'Aceite 5W30');
    }

    public function test_assigning_parts_to_an_order_freezes_price_and_discounts_stock_and_release_restores_it(): void
    {
        $admin = $this->admin();
        $item = $this->item();
        $orderId = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->json('id');

        $this->as($admin)->postJson("/api/v1/service-orders/{$orderId}/parts", ['inventory_item_id' => $item->id, 'quantity' => 2])
            ->assertCreated()->assertJsonPath('totals.parts_total', 236);
        $this->assertSame(3, $item->fresh()->stock);

        // cambiar el precio después no altera lo ya asignado
        $item->update(['sale_price' => 500]);
        $part = PartsRequest::firstOrFail();
        $this->assertEquals(118, $part->unit_price);

        $this->as($admin)->postJson("/api/v1/service-orders/{$orderId}/parts", ['inventory_item_id' => $item->id, 'quantity' => 4])->assertStatus(422);

        $this->as($admin)->deleteJson("/api/v1/service-orders/{$orderId}/parts/{$part->id}")->assertOk();
        $this->assertSame(5, $item->fresh()->stock);
        $this->assertSame(0, PartsRequest::count());
    }

    public function test_tools_cannot_be_assigned_to_orders_and_items_in_use_cannot_be_deleted(): void
    {
        $admin = $this->admin();
        $tool = $this->item(['type' => 'Herramienta', 'code' => 'LLAVE', 'qr_data' => 'LLAVE']);
        $part = $this->item(['code' => 'P1', 'qr_data' => 'P1']);
        $orderId = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->json('id');

        $this->as($admin)->postJson("/api/v1/service-orders/{$orderId}/parts", ['inventory_item_id' => $tool->id, 'quantity' => 1])->assertStatus(422);

        $this->as($admin)->postJson("/api/v1/service-orders/{$orderId}/parts", ['inventory_item_id' => $part->id, 'quantity' => 1])->assertCreated();
        $this->as($admin)->deleteJson("/api/v1/inventory/{$part->id}")->assertStatus(422);
        $this->assertNotNull(Project::find($orderId));
    }

    public function test_technician_can_search_inventory_but_not_modify_it(): void
    {
        [$techUser] = $this->technician();
        $item = $this->item();

        $this->as($techUser)->getJson('/api/v1/inventory?search=bater')->assertOk()->assertJsonCount(1);
        $this->as($techUser)->postJson("/api/v1/inventory/{$item->id}/movements", ['type' => 'Entrada', 'quantity' => 1])->assertForbidden();
        $this->as($techUser)->postJson('/api/v1/inventory', [])->assertForbidden();
    }

    public function test_item_qr_returns_svg_with_all_the_data(): void
    {
        $item = $this->item();

        $response = $this->as($this->admin())->getJson("/api/v1/inventory/{$item->id}/qr")->assertOk();

        $this->assertStringStartsWith('<svg', $response->json('svg'));
        $this->assertSame('BAT-12V', json_decode($response->json('payload'), true)['code']);
    }
}
