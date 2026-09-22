<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Vehicle;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class PlateLookupTest extends TallerTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config(['services.jsonpe.token' => 'token-de-prueba', 'services.jsonpe.url' => 'https://api.json.pe']);
    }

    private function fakeApi(): void
    {
        Http::fake([
            'api.json.pe/api/placa' => Http::response([
                'success' => true,
                'message' => 'exito',
                'data' => [
                    'placa' => 'F3H792', 'marca' => 'FIAT', 'modelo' => 'FIORINO', 'serie' => '9BD25521A98854312',
                    'color' => 'BLANCO BANCHISA', 'motor' => '8632404', 'vin' => '9BD25521A98854312', 'anio' => '2009',
                ],
            ]),
        ]);
    }

    public function test_plate_is_looked_up_in_json_pe_with_bearer_token_and_normalized_plate(): void
    {
        $this->fakeApi();

        $response = $this->as($this->admin())->getJson('/api/v1/vehicles/lookup?plate=f3h-792')->assertOk();

        $response->assertJsonPath('source', 'json.pe')
            ->assertJsonPath('vehicle.brand', 'FIAT')
            ->assertJsonPath('vehicle.model', 'FIORINO')
            ->assertJsonPath('vehicle.year', '2009')
            ->assertJsonPath('vehicle.engine_number', '8632404')
            ->assertJsonPath('vehicle.vin', '9BD25521A98854312')
            ->assertJsonPath('error', null);

        Http::assertSent(fn ($request) => $request->method() === 'POST'
            && $request->url() === 'https://api.json.pe/api/placa'
            && $request->hasHeader('Authorization', 'Bearer token-de-prueba')
            && $request['placa'] === 'F3H792');
    }

    public function test_results_are_cached_so_the_same_plate_does_not_consume_more_queries(): void
    {
        $this->fakeApi();
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=F3H792')->assertOk();
        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=F3H-792')->assertOk()->assertJsonPath('source', 'json.pe');

        Http::assertSentCount(1);
    }

    public function test_a_vehicle_already_registered_is_returned_from_our_own_database_without_calling_the_api(): void
    {
        Http::fake();
        $client = Client::create(['name' => 'Juan Pérez', 'phone' => '987654321', 'document_type' => '1', 'document_number' => '12345678']);
        Vehicle::create(['client_id' => $client->id, 'plate' => 'ABC123', 'brand' => 'Toyota', 'model' => 'Hilux']);

        $this->as($this->admin())->getJson('/api/v1/vehicles/lookup?plate=abc-123')
            ->assertOk()
            ->assertJsonPath('source', 'local')
            ->assertJsonPath('vehicle.brand', 'Toyota')
            ->assertJsonPath('vehicle.client.name', 'Juan Pérez');

        Http::assertNothingSent();
    }

    public function test_unknown_plate_returns_no_vehicle_and_no_error(): void
    {
        Http::fake(['api.json.pe/*' => Http::response(['success' => false, 'message' => 'Bad Request'], 400)]);

        $this->as($this->admin())->getJson('/api/v1/vehicles/lookup?plate=ZZZ999')
            ->assertOk()
            ->assertJsonPath('vehicle', null)
            ->assertJsonPath('source', null)
            ->assertJsonPath('error', null);
    }

    public function test_api_outage_never_breaks_the_screen_and_is_not_cached(): void
    {
        $success = [
            'success' => true,
            'message' => 'exito',
            'data' => ['placa' => 'ABC987', 'marca' => 'KIA', 'modelo' => 'RIO', 'color' => 'ROJO', 'motor' => '1', 'vin' => 'V1', 'anio' => ''],
        ];

        // La primera consulta falla; como no se cachea, la siguiente vuelve a consultar y responde bien.
        Http::fake(['api.json.pe/*' => Http::sequence()->push('boom', 500)->push($success)]);
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=ABC987')->assertOk()->assertJsonPath('vehicle', null)->assertJsonPath('error', 'unavailable');

        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=ABC987')
            ->assertOk()
            ->assertJsonPath('source', 'json.pe')
            ->assertJsonPath('vehicle.brand', 'KIA')
            ->assertJsonPath('vehicle.year', null);
    }

    public function test_without_a_token_the_lookup_reports_it_and_does_not_call_out(): void
    {
        Http::fake();
        config(['services.jsonpe.token' => null]);

        $this->as($this->admin())->getJson('/api/v1/vehicles/lookup?plate=ABC987')->assertOk()->assertJsonPath('error', 'not_configured');

        Http::assertNothingSent();
    }

    public function test_short_plates_are_ignored_and_only_admins_can_query(): void
    {
        Http::fake();

        $this->as($this->admin())->getJson('/api/v1/vehicles/lookup?plate=AB')->assertOk()->assertJsonPath('vehicle', null);
        Http::assertNothingSent();

        [$tech] = $this->technician();
        $this->as($tech)->getJson('/api/v1/vehicles/lookup?plate=ABC987')->assertForbidden();
    }

    public function test_vin_and_engine_number_are_saved_when_receiving_a_vehicle(): void
    {
        $order = $this->as($this->admin())->postJson('/api/v1/service-orders', $this->receptionPayload([
            'plate' => 'F3H-792', 'brand' => 'FIAT', 'model' => 'FIORINO', 'vin' => '9BD25521A98854312', 'engine_number' => '8632404',
        ]))->assertCreated();

        $order->assertJsonPath('vehicle.vin', '9BD25521A98854312')->assertJsonPath('vehicle.engine_number', '8632404');
    }

    public function test_reaching_the_monthly_limit_stops_calling_the_api_until_the_limit_is_raised(): void
    {
        config(['services.jsonpe.monthly_limit' => 2]);
        $this->fakeApi();
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=AAA111')->assertOk()->assertJsonPath('source', 'json.pe');
        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=BBB222')->assertOk()->assertJsonPath('source', 'json.pe');
        Http::assertSentCount(2);

        // Se agotó el límite del mes: no se vuelve a llamar a json.pe para una placa nueva.
        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=CCC333')
            ->assertOk()
            ->assertJsonPath('vehicle', null)
            ->assertJsonPath('error', 'limit_reached');
        Http::assertSentCount(2);

        // Subir el límite (p. ej. al comprar un plan pago) libera la consulta de inmediato, sin tocar código.
        config(['services.jsonpe.monthly_limit' => 3]);
        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=CCC333')->assertOk()->assertJsonPath('source', 'json.pe');
        Http::assertSentCount(3);
    }

    public function test_cached_hits_do_not_count_against_the_monthly_quota(): void
    {
        config(['services.jsonpe.monthly_limit' => 1]);
        $this->fakeApi();
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=F3H792')->assertOk()->assertJsonPath('source', 'json.pe');
        // Misma placa, ya en caché: no consume la única consulta restante del mes.
        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=F3H-792')->assertOk()->assertJsonPath('source', 'json.pe');

        Http::assertSentCount(1);
        $this->assertSame(1, (int) DB::table('plate_lookup_usages')->value('count'));
    }

    public function test_usage_endpoint_reports_used_limit_and_remaining_for_admins_only(): void
    {
        config(['services.jsonpe.monthly_limit' => 5]);
        $this->fakeApi();
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=AAA111');
        $this->as($admin)->getJson('/api/v1/vehicles/lookup?plate=BBB222');

        $this->as($admin)->getJson('/api/v1/vehicles/plate-usage')
            ->assertOk()
            ->assertJsonPath('limit', 5)
            ->assertJsonPath('used', 2)
            ->assertJsonPath('remaining', 3)
            ->assertJsonPath('month', now()->format('Y-m'));

        [$tech] = $this->technician();
        $this->as($tech)->getJson('/api/v1/vehicles/plate-usage')->assertForbidden();
    }
}
