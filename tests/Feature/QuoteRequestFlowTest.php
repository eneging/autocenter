<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectRequest;
use App\Models\Vehicle;

class QuoteRequestFlowTest extends TallerTestCase
{
    public function test_public_request_with_vehicle_becomes_a_service_order_when_approved(): void
    {
        $admin = $this->admin();

        $this->withHeaders(['Origin' => 'http://localhost', 'Referer' => 'http://localhost/'])->postJson('/api/v1/register', [
            'name' => 'Rosa Quispe',
            'email' => 'rosa@example.com',
            'password' => 'secreto123',
            'phone' => '955111222',
            'document_type' => '1',
            'document_number' => '44556677',
            'title' => 'Se apaga en el semáforo',
            'description' => 'El motor se apaga cuando me detengo y tarda en volver a encender',
            'vehicle_plate' => 'abc 987',
            'vehicle_brand' => 'Hyundai',
            'vehicle_model' => 'Accent',
        ])->assertCreated();

        $request = ProjectRequest::firstOrFail();
        $this->assertSame('ABC987', $request->vehicle_plate);

        $this->as($admin)->postJson("/api/v1/quote-requests/{$request->id}/quotation", [
            'delivery_time' => '2 días',
            'items' => [['title' => 'Diagnóstico eléctrico', 'amount' => 80]],
        ])->assertCreated();

        $this->as($admin)->postJson("/api/v1/quote-requests/{$request->id}/approve", [
            'priority' => 'Alta',
            'service_type' => 'Mantenimiento eléctrico',
        ])->assertOk();

        $order = Project::firstOrFail();
        $vehicle = Vehicle::where('plate', 'ABC987')->firstOrFail();

        $this->assertSame($vehicle->id, $order->vehicle_id);
        $this->assertSame('Hyundai Accent - ABC987', $order->name);
        $this->assertSame('Mantenimiento eléctrico', $order->service_type);
        $this->assertStringContainsString('se apaga', $order->problem_description);
        $this->assertSame('Pendiente', $order->status);
        $this->assertStringStartsWith('CAC-', $order->code);
        $this->assertSame(1, $order->trackingLogs()->count());
        $this->assertSame($order->id, $request->fresh()->project_id);

        $this->getJson("/api/v1/tracking/{$order->client_access_token}")->assertOk()->assertJsonPath('vehicle.plate', 'ABC987');
    }

    public function test_request_without_vehicle_data_still_creates_an_order_and_approval_needs_a_quotation(): void
    {
        $admin = $this->admin();

        $this->withHeaders(['Origin' => 'http://localhost', 'Referer' => 'http://localhost/'])->postJson('/api/v1/register', [
            'name' => 'Luis Vega', 'email' => 'luis@example.com', 'password' => 'secreto123',
            'title' => 'Revisión general', 'description' => 'Quiero una revisión completa',
        ])->assertCreated();

        $request = ProjectRequest::firstOrFail();

        $this->as($admin)->postJson("/api/v1/quote-requests/{$request->id}/approve", [])->assertStatus(422);

        $this->as($admin)->postJson("/api/v1/quote-requests/{$request->id}/quotation", [
            'delivery_time' => '1 día', 'items' => [['title' => 'Revisión', 'amount' => 150]],
        ])->assertCreated();
        $this->as($admin)->postJson("/api/v1/quote-requests/{$request->id}/approve", [])->assertOk();

        $order = Project::firstOrFail();
        $this->assertNull($order->vehicle_id);
        $this->assertSame('Revisión general', $order->name);
    }
}
