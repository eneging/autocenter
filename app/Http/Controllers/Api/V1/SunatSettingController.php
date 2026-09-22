<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SunatSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SunatSettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json($this->payload(SunatSetting::current()));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'env' => ['required', Rule::in(['sandbox', 'production'])],
            'token_production' => ['nullable', 'string', 'max:1000'],
        ]);

        $settings = SunatSetting::current();
        $newToken = trim((string) ($data['token_production'] ?? ''));

        if ($newToken !== '') {
            $settings->token_production = $newToken;
        }

        if ($data['env'] === 'production' && ! $settings->hasProductionToken()) {
            abort(422, 'Ingresa el token de produccion de SUNAT antes de activar este modo.');
        }

        $settings->env = $data['env'];
        $settings->save();

        return response()->json($this->payload($settings->fresh()));
    }

    private function payload(SunatSetting $settings): array
    {
        return [
            'env' => $settings->env,
            'has_production_token' => $settings->hasProductionToken(),
        ];
    }
}
