<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GoogleToken;
use App\Services\GoogleDriveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class GoogleDriveController extends Controller
{
    public function __construct(private readonly GoogleDriveService $drive)
    {
    }

    public function connect(): RedirectResponse
    {
        return redirect()->away($this->drive->getAuthUrl());
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->query('code')) {
            $this->drive->handleCallback($request->query('code'));
        }

        return redirect()->away('/app?google=connected');
    }

    public function status(): JsonResponse
    {
        $token = GoogleToken::current();

        return response()->json([
            'connected' => (bool) $token->refresh_token,
            'email' => $token->connected_email,
        ]);
    }
}
