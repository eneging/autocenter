<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Promotion;
use App\Models\Vehicle;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class ReportsInvoicesPromotionsTest extends TallerTestCase
{
    private function seedMovements(): void
    {
        $admin = $this->admin();
        $id = $this->as($admin)->postJson('/api/v1/cash-registers', ['opening_amount' => 0])->json('id');
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", ['type' => 'Ingreso', 'category' => 'Servicio', 'payment_method' => 'Yape', 'amount' => 118, 'is_taxable' => true]);
        $this->as($admin)->postJson("/api/v1/cash-registers/{$id}/transactions", ['type' => 'Gasto Fijo', 'category' => 'Alquiler', 'amount' => 40]);
    }

    public function test_daily_weekly_and_monthly_reports_aggregate_the_same_movements(): void
    {
        $this->seedMovements();
        $admin = $this->admin();

        foreach ([['daily', today()->toDateString()], ['weekly', today()->toDateString()], ['monthly', today()->format('Y-m')]] as [$period, $date]) {
            $report = $this->as($admin)->getJson("/api/v1/reports/{$period}?date={$date}")->assertOk();
            $report->assertJsonPath('summary.income_total', 118)->assertJsonPath('summary.fixed_expenses_total', 40)->assertJsonPath('summary.net_result', 78);
        }

        $this->as($admin)->getJson('/api/v1/reports/yearly?date=2026')->assertNotFound();
        $this->as($admin)->getJson('/api/v1/reports/monthly?date=2026-13-40')->assertStatus(422);
    }

    public function test_reports_export_to_pdf_and_excel(): void
    {
        $this->seedMovements();
        $admin = $this->admin();
        $date = today()->format('Y-m');

        $pdf = $this->as($admin)->get("/api/v1/reports/monthly/export?date={$date}&format=pdf")->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $pdf->getContent());

        $xlsx = $this->as($admin)->get("/api/v1/reports/monthly/export?date={$date}&format=xlsx")->assertOk();
        $this->assertStringContainsString('spreadsheetml', $xlsx->headers->get('content-type'));
        $this->assertStringStartsWith('PK', $xlsx->baseResponse->getFile()->getContent());

        $this->as($admin)->getJson("/api/v1/reports/monthly/export?date={$date}&format=csv")->assertStatus(422);
    }

    public function test_invoices_are_filed_by_year_month_folder_and_can_be_voided(): void
    {
        Storage::fake('local');
        $admin = $this->admin();

        $response = $this->as($admin)->post('/api/v1/invoices', [
            'type' => 'Factura', 'number' => 'F001-000123', 'issue_date' => '2026-03-15', 'customer_name' => 'Taller SAC', 'total' => 590,
            'file' => UploadedFile::fake()->create('factura.pdf', 50, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $invoice = Invoice::findOrFail($response->json('id'));
        $this->assertStringStartsWith('invoices/2026/03/', $invoice->file_path);
        Storage::disk('local')->assertExists($invoice->file_path);
        $this->assertSame('2026/03', $invoice->folder);

        $this->as($admin)->post('/api/v1/invoices', [
            'type' => 'Factura', 'number' => 'F001-000123', 'issue_date' => '2026-03-15',
            'file' => UploadedFile::fake()->create('otra.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->as($admin)->getJson('/api/v1/invoices/folders')->assertOk()->assertJsonPath('0.folder', '2026/03')->assertJsonPath('0.count', 1);
        $this->as($admin)->getJson('/api/v1/invoices?folder=2026/03')->assertOk()->assertJsonCount(1);
        $this->as($admin)->getJson('/api/v1/invoices?folder=2026/04')->assertOk()->assertJsonCount(0);

        $this->as($admin)->postJson("/api/v1/invoices/{$invoice->id}/void", [])->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/invoices/{$invoice->id}/void", ['reason' => 'Error en el monto'])->assertOk()->assertJsonPath('status', 'Dado de baja');
        $this->as($admin)->postJson("/api/v1/invoices/{$invoice->id}/void", ['reason' => 'otra vez'])->assertStatus(422);

        Storage::disk('local')->assertExists($invoice->file_path);
        $this->as($admin)->get("/api/v1/invoices/{$invoice->id}/download")->assertOk();
    }

    public function test_coupon_registration_generates_unique_code_rejects_duplicates_and_can_be_redeemed_once(): void
    {
        $admin = $this->admin();
        $promotion = Promotion::create(['type' => 'cupon', 'title' => '10% off', 'discount_percent' => 10, 'coupon_prefix' => 'CAC']);

        $payload = ['name' => 'María', 'phone' => '987 654 321', 'accepted_terms' => true];

        $response = $this->postJson("/api/v1/promotions/{$promotion->id}/register", $payload)->assertCreated();
        $this->assertMatchesRegularExpression('/^CAC-[A-Z0-9]{6}$/', $response->json('coupon_code'));

        $this->postJson("/api/v1/promotions/{$promotion->id}/register", $payload)->assertStatus(422);
        $this->postJson("/api/v1/promotions/{$promotion->id}/register", ['name' => 'Otro', 'phone' => '911111111'])->assertStatus(422);
        $this->assertSame(1, $promotion->entries()->count());

        $entryId = $promotion->entries()->first()->id;
        $this->as($admin)->getJson('/api/v1/coupons/lookup?code='.$response->json('coupon_code'))->assertOk()->assertJsonPath('promotion.discount_percent', 10);
        $this->as($admin)->postJson("/api/v1/promotion-entries/{$entryId}/redeem")->assertOk();
        $this->as($admin)->postJson("/api/v1/promotion-entries/{$entryId}/redeem")->assertStatus(422);
    }

    public function test_only_open_promotions_are_public_and_raffle_picks_a_single_winner(): void
    {
        $admin = $this->admin();
        $raffle = Promotion::create(['type' => 'sorteo', 'title' => 'Sorteo de aniversario']);
        Promotion::create(['type' => 'evento', 'title' => 'Vencido', 'ends_at' => now()->subDay()]);
        Promotion::create(['type' => 'evento', 'title' => 'Apagado', 'is_active' => false]);

        $this->getJson('/api/v1/promotions')->assertOk()->assertJsonCount(1)->assertJsonPath('0.title', 'Sorteo de aniversario');

        $this->as($admin)->postJson("/api/v1/admin/promotions/{$raffle->id}/draw")->assertStatus(422);

        foreach (['900000001', '900000002', '900000003'] as $phone) {
            $this->postJson("/api/v1/promotions/{$raffle->id}/register", ['name' => "P{$phone}", 'phone' => $phone, 'accepted_terms' => true])->assertCreated();
        }

        $winner = $this->as($admin)->postJson("/api/v1/admin/promotions/{$raffle->id}/draw")->assertOk()->json('winner.id');
        $this->assertNotNull($winner);
        $this->as($admin)->postJson("/api/v1/admin/promotions/{$raffle->id}/draw")->assertStatus(422);
    }

    public function test_registration_requires_accepting_the_terms(): void
    {
        $promotion = Promotion::create(['type' => 'evento', 'title' => 'Feria']);

        $this->postJson("/api/v1/promotions/{$promotion->id}/register", ['name' => 'Ana', 'phone' => '900000009'])->assertStatus(422);
        $this->assertSame(0, $promotion->entries()->count());
    }

    public function test_maintenance_reminders_are_sent_once_per_scheduled_date(): void
    {
        config(['services.whatsapp.token' => 'tok', 'services.whatsapp.phone_number_id' => '123']);
        Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'x']]], 200)]);

        $client = Client::create(['name' => 'Luis Ramos', 'phone' => '955444333', 'document_type' => '1', 'document_number' => '11112222']);
        Vehicle::create(['client_id' => $client->id, 'plate' => 'AAA111', 'brand' => 'Kia', 'model' => 'Rio', 'next_maintenance_at' => today()->addDays(2)]);
        Vehicle::create(['client_id' => $client->id, 'plate' => 'BBB222', 'brand' => 'Kia', 'model' => 'Soul', 'next_maintenance_at' => today()->addDays(30)]);

        $this->artisan('taller:send-reminders')->assertSuccessful();
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request['to'] === '51955444333' && str_contains($request['text']['body'], 'AAA111'));

        $this->artisan('taller:send-reminders')->assertSuccessful();
        Http::assertSentCount(1);
    }

    public function test_reminder_command_does_nothing_without_whatsapp_credentials(): void
    {
        config(['services.whatsapp.token' => null, 'services.whatsapp.phone_number_id' => null]);
        Http::fake();

        $this->artisan('taller:send-reminders')->assertSuccessful();
        Http::assertNothingSent();
    }
}
