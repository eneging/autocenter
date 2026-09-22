<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Models\PromotionEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Captación de clientes: eventos, sorteos y cupones de descuento.
 * Solo se guardan datos de quienes completan el registro (con aceptación de términos).
 */
class PromotionController extends Controller
{
    /** Público: promociones vigentes. */
    public function publicIndex(): JsonResponse
    {
        return response()->json(
            Promotion::open()->latest()->get(['id', 'type', 'title', 'description', 'image_url', 'discount_percent', 'starts_at', 'ends_at'])
        );
    }

    /** Público: registro de un participante. */
    public function register(Request $request, Promotion $promotion): JsonResponse
    {
        abort_unless(Promotion::open()->whereKey($promotion->id)->exists(), 404, 'Esta promoción ya no está disponible.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'min:7', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'document_number' => ['nullable', 'string', 'max:20'],
            'accepted_terms' => ['accepted'],
        ]);

        $phone = preg_replace('/\D+/', '', $data['phone']);

        if ($promotion->entries()->where('phone', $phone)->exists()) {
            abort(422, 'Este número ya está registrado en la promoción.');
        }

        $entry = $promotion->entries()->create([
            'name' => $data['name'],
            'phone' => $phone,
            'email' => $data['email'] ?? null,
            'document_number' => $data['document_number'] ?? null,
            'accepted_terms' => true,
            'coupon_code' => $promotion->type === 'cupon' ? $this->couponCode($promotion) : null,
        ]);

        return response()->json([
            'message' => match ($promotion->type) {
                'cupon' => '¡Listo! Guarda tu cupón y preséntalo en el taller.',
                'sorteo' => '¡Ya estás participando en el sorteo!',
                default => '¡Registro confirmado! Te esperamos.',
            },
            'coupon_code' => $entry->coupon_code,
            'discount_percent' => $promotion->discount_percent,
        ], 201);
    }

    public function index(): JsonResponse
    {
        return response()->json(Promotion::withCount('entries')->with('winner:id,name,phone')->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(Promotion::create($this->validated($request)), 201);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $promotion->update($this->validated($request));

        return response()->json($promotion->fresh());
    }

    public function destroy(Promotion $promotion): JsonResponse
    {
        $promotion->delete();

        return response()->json(status: 204);
    }

    public function entries(Promotion $promotion): JsonResponse
    {
        return response()->json($promotion->entries()->latest()->get());
    }

    /** Sorteo: elige un ganador al azar entre los participantes registrados. */
    public function draw(Promotion $promotion): JsonResponse
    {
        abort_unless($promotion->type === 'sorteo', 422, 'Solo los sorteos tienen ganador.');
        abort_if($promotion->winner_entry_id, 422, 'Este sorteo ya tiene un ganador.');

        $winner = $promotion->entries()->inRandomOrder()->first();
        abort_unless($winner, 422, 'Aún no hay participantes.');

        $promotion->update(['winner_entry_id' => $winner->id]);

        return response()->json($promotion->fresh()->load('winner:id,name,phone'));
    }

    public function redeem(PromotionEntry $entry): JsonResponse
    {
        abort_unless($entry->coupon_code, 422, 'Este registro no tiene cupón.');
        abort_if($entry->redeemed_at, 422, 'El cupón ya fue canjeado.');

        $entry->update(['redeemed_at' => now()]);

        return response()->json($entry->fresh());
    }

    /** Valida un código de cupón en caja/recepción. */
    public function lookupCoupon(Request $request): JsonResponse
    {
        $code = Str::upper(trim((string) $request->query('code', '')));
        $entry = PromotionEntry::with('promotion:id,title,discount_percent')->where('coupon_code', $code)->first();

        abort_unless($entry, 404, 'Cupón no encontrado.');

        return response()->json($entry);
    }

    private function couponCode(Promotion $promotion): string
    {
        $prefix = Str::upper($promotion->coupon_prefix ?: 'CAC');

        do {
            $code = $prefix.'-'.Str::upper(Str::random(6));
        } while (PromotionEntry::where('coupon_code', $code)->exists());

        return $code;
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['evento', 'sorteo', 'cupon'])],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'discount_percent' => ['nullable', 'integer', 'min:1', 'max:100', Rule::requiredIf($request->input('type') === 'cupon')],
            'coupon_prefix' => ['nullable', 'string', 'max:12', 'alpha_num'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $data['is_active'] ??= true;

        return $data;
    }
}
