<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Project;
use App\Models\TrackingLog;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Http;

class ServiceOrderFlowTest extends TallerTestCase
{
    public function test_reception_creates_client_vehicle_order_and_first_tracking_entry(): void
    {
        $admin = $this->admin();

        $response = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload());

        $response->assertCreated()
            ->assertJsonPath('status', 'Pendiente')
            ->assertJsonPath('vehicle.plate', 'ABC123')
            ->assertJsonPath('client.document_number', '12345678');

        $project = Project::firstOrFail();
        $this->assertNotEmpty($project->client_access_token);
        $this->assertSame(1, Vehicle::count());
        $this->assertSame(1, TrackingLog::where('project_id', $project->id)->count());
        $this->assertStringStartsWith('CAC-', $project->code);
    }

    public function test_second_reception_with_same_plate_and_document_reuses_records(): void
    {
        $admin = $this->admin();

        $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->assertCreated();
        $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload(['plate' => 'ABC 123']))->assertCreated();

        $this->assertSame(1, Vehicle::count());
        $this->assertSame(1, Client::count());
        $this->assertSame(2, Project::count());
        $this->assertNotSame(Project::first()->code, Project::latest('id')->first()->code);
    }

    public function test_dni_and_ruc_lengths_are_validated(): void
    {
        $this->as($this->admin())
            ->postJson('/api/v1/service-orders', $this->receptionPayload(['document_number' => '123']))
            ->assertStatus(422);

        $this->as($this->admin())
            ->postJson('/api/v1/service-orders', $this->receptionPayload(['document_type' => '6', 'document_number' => '12345678']))
            ->assertStatus(422);
    }

    public function test_technician_only_sees_and_edits_assigned_orders(): void
    {
        $admin = $this->admin();
        [$techUser, $worker] = $this->technician();
        [, $otherWorker] = $this->technician('Otro');

        $mine = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload(['responsible_worker_id' => $worker->id]))->json('id');
        $theirs = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload(['plate' => 'XYZ-987', 'document_number' => '87654321', 'responsible_worker_id' => $otherWorker->id]))->json('id');

        $this->as($techUser)->getJson('/api/v1/service-orders')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $mine);
        $this->as($techUser)->getJson("/api/v1/service-orders/{$theirs}")->assertForbidden();
        $this->as($techUser)->putJson("/api/v1/service-orders/{$theirs}", ['solution' => 'x'])->assertForbidden();

        $this->as($techUser)->putJson("/api/v1/service-orders/{$mine}", [
            'technical_diagnostic' => 'Batería sulfatada',
            'solution' => 'Cambio de batería',
            'budget' => 350,
            'estimated_time' => '2 días',
            'service_type' => 'Reparación',
        ])->assertOk()->assertJsonPath('technical_diagnostic', 'Batería sulfatada')->assertJsonPath('totals.service_budget', 350);

        // un técnico no puede reasignar la orden
        $this->as($techUser)->putJson("/api/v1/service-orders/{$mine}", ['responsible_worker_id' => $otherWorker->id])->assertOk();
        $this->assertSame($worker->id, Project::find($mine)->responsible_worker_id);
    }

    public function test_finishing_an_order_sets_exit_date_and_public_tracking_shows_receipt_without_internal_data(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->json('id');
        $project = Project::find($id);
        $project->update(['notes' => 'nota interna secreta', 'budget' => 200]);

        $this->as($admin)->patchJson("/api/v1/service-orders/{$id}/status", ['status' => 'En Proceso'])->assertOk();
        $tracking = $this->getJson("/api/v1/tracking/{$project->client_access_token}")->assertOk();
        $tracking->assertJsonPath('order.status', 'En Proceso')->assertJsonPath('receipt', null);

        $this->as($admin)->patchJson("/api/v1/service-orders/{$id}/status", ['status' => 'Finalizado'])->assertOk();
        $this->assertNotNull($project->fresh()->exit_date);

        $final = $this->getJson("/api/v1/tracking/{$project->client_access_token}")->assertOk();
        $final->assertJsonPath('receipt.total', 200)->assertJsonPath('feedback.can_comment', true);
        $this->assertStringNotContainsString('nota interna secreta', $final->getContent());
        $this->assertStringNotContainsString('987654321', $final->getContent());
        $this->assertStringNotContainsString('12345678', $final->getContent());

        $this->getJson('/api/v1/tracking/token-inexistente')->assertNotFound();
    }

    public function test_client_can_comment_only_when_finished_and_only_once(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->json('id');
        $token = Project::find($id)->client_access_token;

        $this->postJson("/api/v1/tracking/{$token}/comment", ['comment' => 'Muy buen servicio'])->assertStatus(422);

        $this->as($admin)->patchJson("/api/v1/service-orders/{$id}/status", ['status' => 'Finalizado']);

        $this->postJson("/api/v1/tracking/{$token}/comment", ['comment' => 'Muy buen servicio', 'rating' => 5])
            ->assertCreated()
            ->assertJsonPath('feedback.submitted', true)
            ->assertJsonPath('feedback.rating', 5);

        $this->postJson("/api/v1/tracking/{$token}/comment", ['comment' => 'Otra vez'])->assertStatus(422);
    }

    public function test_status_change_sends_whatsapp_once_per_status_when_configured(): void
    {
        config([
            'services.whatsapp.token' => 'tok',
            'services.whatsapp.phone_number_id' => '123',
        ]);
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]], 200)]);

        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->json('id');
        Http::assertSentCount(1);

        $this->as($admin)->patchJson("/api/v1/service-orders/{$id}/status", ['status' => 'En Proceso']);
        Http::assertSentCount(2);

        Http::assertSent(fn ($request) => $request['to'] === '51987654321' && str_contains($request['text']['body'], '/seguimiento/'));

        $this->as($admin)->patchJson("/api/v1/service-orders/{$id}/status", ['status' => 'En Proceso']);
        Http::assertSentCount(2);
    }

    public function test_tracking_log_accepts_annotation_without_image(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload())->json('id');

        $this->as($admin)->postJson("/api/v1/service-orders/{$id}/logs", ['annotation' => 'Se desmontó el alternador'])->assertCreated();
        $this->as($admin)->postJson("/api/v1/service-orders/{$id}/logs", [])->assertStatus(422);

        $token = Project::find($id)->client_access_token;
        $timeline = $this->getJson("/api/v1/tracking/{$token}")->json('timeline');
        $this->assertSame('Se desmontó el alternador', $timeline[0]['annotation']);
    }
}
