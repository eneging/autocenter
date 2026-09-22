<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\AttendanceQrCode;
use App\Models\PayrollAdvance;
use App\Models\Worker;
use Illuminate\Support\Carbon;

class PersonnelTest extends TallerTestCase
{
    public function test_admin_generates_a_shift_qr_with_an_expiration_or_makes_it_infinite(): void
    {
        $admin = $this->admin();

        $this->as($admin)->getJson('/api/v1/attendance/qr')->assertOk()->assertJson([]);

        $withExpiry = $this->as($admin)->postJson('/api/v1/attendance/qr', [
            'never_expires' => false, 'expires_at' => now()->addDay()->toDateTimeString(),
        ])->assertCreated();
        $this->assertNotNull($withExpiry->json('expires_at'));
        $this->assertStringStartsWith('<svg', $withExpiry->json('svg'));

        // Pedir uno nuevo "infinito" desactiva el anterior: solo hay un QR vigente a la vez.
        $infinite = $this->as($admin)->postJson('/api/v1/attendance/qr', ['never_expires' => true])->assertCreated();
        $this->assertNull($infinite->json('expires_at'));

        $current = $this->as($admin)->getJson('/api/v1/attendance/qr')->assertOk();
        $this->assertSame($infinite->json('id'), $current->json('id'));
        $this->assertSame(1, AttendanceQrCode::where('is_active', true)->count());
    }

    public function test_technician_scans_the_shift_qr_from_their_own_account_to_toggle_entry_and_exit(): void
    {
        $admin = $this->admin();
        [$techUser, $worker] = $this->technician();

        $qr = $this->as($admin)->postJson('/api/v1/attendance/qr', ['never_expires' => true])->json();
        $token = AttendanceQrCode::findOrFail($qr['id'])->token;

        $this->as($techUser)->postJson('/api/v1/my-attendance/scan', ['code' => $token])
            ->assertCreated()->assertJsonPath('type', 'Entrada');
        $this->as($techUser)->postJson('/api/v1/my-attendance/scan', ['code' => $token])
            ->assertOk()->assertJsonPath('type', 'Salida');

        $this->assertNotNull(Attendance::first()->clock_out);
        $this->assertSame($worker->id, Attendance::first()->worker_id);
    }

    public function test_expired_revoked_or_unknown_codes_are_rejected_without_marking_anything(): void
    {
        [$techUser] = $this->technician();

        $this->as($techUser)->postJson('/api/v1/my-attendance/scan', ['code' => 'ASIST-NOEXISTE'])->assertNotFound();

        $admin = $this->admin();
        $expired = $this->as($admin)->postJson('/api/v1/attendance/qr', ['never_expires' => false, 'expires_at' => now()->addMinute()->toDateTimeString()])->json();
        $code = AttendanceQrCode::findOrFail($expired['id']);
        $code->update(['expires_at' => now()->subMinute()]);

        $this->as($techUser)->postJson('/api/v1/my-attendance/scan', ['code' => $code->token])->assertStatus(422);

        $active = $this->as($admin)->postJson('/api/v1/attendance/qr', ['never_expires' => true])->json();
        $this->as($admin)->postJson("/api/v1/attendance/qr/{$active['id']}/revoke")->assertOk()->assertJsonPath('is_active', false);
        $this->as($techUser)->postJson('/api/v1/my-attendance/scan', ['code' => AttendanceQrCode::findOrFail($active['id'])->token])->assertStatus(422);

        $this->assertSame(0, Attendance::count());
    }

    public function test_only_admin_manages_the_shift_qr_and_only_technicians_can_scan_it(): void
    {
        [$techUser] = $this->technician();
        $admin = $this->admin();

        $this->as($techUser)->getJson('/api/v1/attendance/qr')->assertForbidden();
        $this->as($techUser)->postJson('/api/v1/attendance/qr', ['never_expires' => true])->assertForbidden();

        $qr = $this->as($admin)->postJson('/api/v1/attendance/qr', ['never_expires' => true])->json();
        $token = AttendanceQrCode::findOrFail($qr['id'])->token;

        $this->as($admin)->postJson('/api/v1/my-attendance/scan', ['code' => $token])->assertForbidden();
    }

    public function test_worker_requests_advance_admin_approves_and_pays_it_through_the_cash_register(): void
    {
        $admin = $this->admin();
        [$techUser, $worker] = $this->technician();

        $id = $this->as($techUser)->postJson('/api/v1/my-advances', ['amount' => 150, 'reason' => 'Emergencia'])->assertCreated()->json('id');
        $this->as($techUser)->postJson('/api/v1/my-advances', ['amount' => 50])->assertStatus(422);
        $this->as($techUser)->getJson('/api/v1/my-advances')->assertOk()->assertJsonCount(1);

        $this->as($techUser)->postJson("/api/v1/payroll-advances/{$id}/approve")->assertForbidden();
        $this->as($admin)->postJson("/api/v1/payroll-advances/{$id}/pay")->assertStatus(422);
        $this->as($admin)->postJson("/api/v1/payroll-advances/{$id}/approve")->assertOk()->assertJsonPath('status', 'Aprobado');
        $this->as($admin)->postJson("/api/v1/payroll-advances/{$id}/approve")->assertStatus(422);

        $this->as($admin)->postJson("/api/v1/payroll-advances/{$id}/pay", ['register_in_cash' => true, 'payment_method' => 'Efectivo'])->assertStatus(422);

        $this->as($admin)->postJson('/api/v1/cash-registers', []);
        $this->as($admin)->postJson("/api/v1/payroll-advances/{$id}/pay", ['register_in_cash' => true, 'payment_method' => 'Efectivo'])
            ->assertOk()->assertJsonPath('status', 'Pagado');

        $this->assertDatabaseHas('transactions', ['category' => 'Sueldos', 'amount' => 150, 'worker_id' => $worker->id]);
    }

    public function test_paid_advances_are_deducted_from_the_next_payroll_payment(): void
    {
        $admin = $this->admin();
        [, $worker] = $this->technician();
        $worker->update(['hourly_rate' => 10]);

        Attendance::create([
            'worker_id' => $worker->id,
            'date' => Carbon::yesterday()->toDateString(),
            'clock_in' => Carbon::yesterday()->setTime(8, 0),
            'clock_out' => Carbon::yesterday()->setTime(18, 0), // 10 h * 10 = 100
        ]);

        $old = PayrollAdvance::create(['worker_id' => $worker->id, 'amount' => 30, 'status' => 'Pagado', 'requested_at' => now()->subDays(3)]);
        $new = PayrollAdvance::create(['worker_id' => $worker->id, 'amount' => 90, 'status' => 'Pagado', 'requested_at' => now()->subDay()]);

        $range = ['from' => Carbon::yesterday()->toDateString(), 'to' => today()->toDateString()];

        $summary = $this->as($admin)->getJson("/api/v1/workers/{$worker->id}/payment-summary?".http_build_query($range))->assertOk();
        $summary->assertJsonPath('total_amount', 100)->assertJsonPath('advances_deductible', 30)->assertJsonPath('net_amount', 70);

        $payment = $this->as($admin)->postJson('/api/v1/worker-payments', [
            'worker_id' => $worker->id, 'period_start' => $range['from'], 'period_end' => $range['to'], 'paid_at' => today()->toDateString(),
        ])->assertCreated();

        $this->assertEquals(30, $payment->json('advances_deducted'));
        $this->assertSame($payment->json('id'), $old->fresh()->worker_payment_id);
        $this->assertNull($new->fresh()->worker_payment_id);

        $this->as($admin)->deleteJson('/api/v1/worker-payments/'.$payment->json('id'))->assertNoContent();
        $this->assertNull($old->fresh()->worker_payment_id);
        $this->assertNotNull(Worker::find($worker->id));
    }
}
