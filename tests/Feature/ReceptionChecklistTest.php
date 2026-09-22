<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;

class ReceptionChecklistTest extends TallerTestCase
{
    public function test_reception_options_expose_the_checklist_catalog(): void
    {
        $response = $this->as($this->admin())->getJson('/api/v1/reception-options')->assertOk();

        $response->assertJsonStructure(['fuel_levels', 'exterior_items', 'tool_items', 'level_items', 'level_options', 'damage_zones', 'pickup_hours', 'storage_fee_per_day', 'liability_text']);
        $this->assertContains('Vacío', $response->json('fuel_levels'));
    }

    public function test_client_accepting_terms_is_required_to_receive_a_vehicle(): void
    {
        $this->as($this->admin())
            ->postJson('/api/v1/service-orders', $this->receptionPayload(['client_accepts_terms' => false]))
            ->assertStatus(422);

        $this->as($this->admin())
            ->postJson('/api/v1/service-orders', $this->receptionPayload())
            ->assertCreated();

        $this->assertNotNull(Project::first()->client_accepted_terms_at);
    }

    public function test_reception_checklist_mileage_fuel_and_authorizations_are_saved(): void
    {
        $checklist = [
            'exterior' => ['Vidrios / lunas' => false, 'Antena' => true],
            'tools' => ['Llanta de repuesto' => false],
            'levels' => ['Batería' => 'Regular'],
            'damages' => ['Frontal' => ['has_damage' => true, 'note' => 'Rayón en el parachoques']],
        ];

        $order = $this->as($this->admin())->postJson('/api/v1/service-orders', $this->receptionPayload([
            'address' => 'Av. Los Álamos 123',
            'mileage' => 45000,
            'fuel_level' => '1/2',
            'reception_checklist' => $checklist,
            'client_requests_prior_budget' => true,
            'client_authorizes_test_drive' => true,
        ]))->assertCreated();

        $project = Project::findOrFail($order->json('id'));

        $this->assertSame(45000, $project->mileage);
        $this->assertSame('1/2', $project->fuel_level);
        $this->assertFalse($project->reception_checklist['exterior']['Vidrios / lunas']);
        $this->assertTrue($project->reception_checklist['damages']['Frontal']['has_damage']);
        $this->assertTrue($project->client_requests_prior_budget);
        $this->assertFalse($project->client_authorizes_repair_without_budget);
        $this->assertTrue($project->client_authorizes_test_drive);
        $this->assertSame('Av. Los Álamos 123', $project->client->address);
    }

    public function test_reception_fields_can_be_completed_after_the_order_was_already_created(): void
    {
        $order = $this->as($this->admin())->postJson('/api/v1/service-orders', $this->receptionPayload())->assertCreated();
        $project = Project::findOrFail($order->json('id'));

        $checklist = [
            'exterior' => ['Vidrios / lunas' => false],
            'tools' => ['Llanta de repuesto' => false],
            'levels' => ['Batería' => 'Malo'],
            'damages' => ['Frontal' => ['has_damage' => true, 'note' => 'Rayón detectado al desarmar']],
        ];

        $this->as($this->admin())
            ->putJson("/api/v1/service-orders/{$project->id}", [
                'mileage' => 52000,
                'fuel_level' => '3/4',
                'reception_checklist' => $checklist,
                'client_requests_prior_budget' => false,
                'client_authorizes_repair_without_budget' => true,
                'client_authorizes_test_drive' => true,
            ])
            ->assertOk();

        $project->refresh();

        $this->assertSame(52000, $project->mileage);
        $this->assertSame('3/4', $project->fuel_level);
        $this->assertTrue($project->reception_checklist['damages']['Frontal']['has_damage']);
        $this->assertFalse($project->client_requests_prior_budget);
        $this->assertTrue($project->client_authorizes_repair_without_budget);
        $this->assertTrue($project->client_authorizes_test_drive);
    }

    public function test_reception_pdf_downloads_for_admin_and_the_assigned_technician_only(): void
    {
        $admin = $this->admin();
        [$techUser, $worker] = $this->technician();
        [, $otherWorker] = $this->technician('Otro');

        $id = $this->as($admin)->postJson('/api/v1/service-orders', $this->receptionPayload(['responsible_worker_id' => $worker->id]))->json('id');

        $pdf = $this->as($admin)->get("/api/v1/service-orders/{$id}/reception-pdf")->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $this->as($techUser)->get("/api/v1/service-orders/{$id}/reception-pdf")->assertOk();

        $otherTechUser = User::findOrFail($otherWorker->user_id);
        $this->as($otherTechUser)->get("/api/v1/service-orders/{$id}/reception-pdf")->assertForbidden();
    }
}
