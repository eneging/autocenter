<?php

namespace App\Services;

use App\Models\GoogleToken;
use App\Models\Project;
use Google\Client;
use GuzzleHttp\ClientInterface;
use Illuminate\Http\UploadedFile;
use Psr\Http\Message\ResponseInterface;
use RuntimeException;

class GoogleDriveService
{
    private const SCOPES = [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
    ];

    public function getClient(): Client
    {
        $client = new Client;
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));
        $client->setScopes(self::SCOPES);
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        $token = GoogleToken::current();

        if ($token->token_payload) {
            $client->setAccessToken($token->token_payload);

            if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                $newToken = $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());
                $this->persistToken($newToken, $token->refresh_token);
                $client->setAccessToken($newToken);
            }
        }

        return $client;
    }

    public function getAuthUrl(): string
    {
        return $this->getClient()->createAuthUrl();
    }

    public function handleCallback(string $code): void
    {
        $client = $this->getClient();
        $result = $client->fetchAccessTokenWithAuthCode($code);

        if (isset($result['error'])) {
            throw new RuntimeException('Google OAuth error: '.$result['error_description'] ?? $result['error']);
        }

        $token = GoogleToken::current();
        $this->persistToken($result, $token->refresh_token);

        $client->setAccessToken($result);
        $email = $this->fetchConnectedEmail($this->authorizedHttp($client));
        GoogleToken::current()->update(['connected_email' => $email]);
    }

    public function isConnected(): bool
    {
        return (bool) GoogleToken::current()->refresh_token;
    }

    public function ensureProjectFolder(Project $project): string
    {
        if ($project->drive_folder_id) {
            return $project->drive_folder_id;
        }

        $http = $this->authorizedHttp($this->getClient());
        $rootId = $this->ensureRootFolder($http);
        $folderId = $this->createFolder($http, "{$project->code} - {$project->name}", $rootId);

        $project->update(['drive_folder_id' => $folderId]);

        return $folderId;
    }

    public function uploadFile(UploadedFile $file, string $folderId): array
    {
        $http = $this->authorizedHttp($this->getClient());

        $metadata = [
            'name' => $file->getClientOriginalName(),
            'parents' => [$folderId],
        ];

        $response = $http->request('POST', 'https://www.googleapis.com/upload/drive/v3/files', [
            'query' => ['uploadType' => 'multipart', 'fields' => 'id,webViewLink,thumbnailLink'],
            'multipart' => [
                [
                    'name' => 'metadata',
                    'contents' => json_encode($metadata),
                    'headers' => ['Content-Type' => 'application/json'],
                ],
                [
                    'name' => 'file',
                    'contents' => fopen($file->getRealPath(), 'r'),
                    'headers' => ['Content-Type' => $file->getMimeType()],
                ],
            ],
        ]);

        $data = $this->decodeOrFail($response, 'subir el archivo');

        $http->request('POST', "https://www.googleapis.com/drive/v3/files/{$data['id']}/permissions", [
            'json' => ['role' => 'reader', 'type' => 'anyone'],
        ]);

        return $data;
    }

    public function deleteFile(string $fileId): void
    {
        $http = $this->authorizedHttp($this->getClient());
        $http->request('DELETE', "https://www.googleapis.com/drive/v3/files/{$fileId}");
    }

    private function ensureRootFolder(ClientInterface $http): string
    {
        $token = GoogleToken::current();

        if ($token->root_folder_id) {
            return $token->root_folder_id;
        }

        $folderId = $this->findFolder($http, 'Segmentos', null) ?? $this->createFolder($http, 'Segmentos', null);
        $token->update(['root_folder_id' => $folderId]);

        return $folderId;
    }

    private function findFolder(ClientInterface $http, string $name, ?string $parentId): ?string
    {
        $query = "name='".addslashes($name)."' and mimeType='application/vnd.google-apps.folder' and trashed=false";
        if ($parentId) {
            $query .= " and '{$parentId}' in parents";
        }

        $response = $http->request('GET', 'https://www.googleapis.com/drive/v3/files', [
            'query' => ['q' => $query, 'fields' => 'files(id)'],
        ]);

        $data = $this->decodeOrFail($response, 'buscar la carpeta en Drive');

        return $data['files'][0]['id'] ?? null;
    }

    private function createFolder(ClientInterface $http, string $name, ?string $parentId): string
    {
        $metadata = [
            'name' => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
        ];
        if ($parentId) {
            $metadata['parents'] = [$parentId];
        }

        $response = $http->request('POST', 'https://www.googleapis.com/drive/v3/files', [
            'json' => $metadata,
            'query' => ['fields' => 'id'],
        ]);

        $data = $this->decodeOrFail($response, 'crear la carpeta en Drive');

        return $data['id'];
    }

    private function decodeOrFail(ResponseInterface $response, string $action): array
    {
        $data = json_decode((string) $response->getBody(), true);

        if (! is_array($data) || isset($data['error'])) {
            $message = is_array($data) ? json_encode($data['error'] ?? $data) : (string) $response->getBody();
            throw new RuntimeException("No se pudo {$action}: {$message}");
        }

        return $data;
    }

    private function fetchConnectedEmail(ClientInterface $http): ?string
    {
        $response = $http->request('GET', 'https://www.googleapis.com/oauth2/v2/userinfo');
        $data = json_decode((string) $response->getBody(), true);

        return $data['email'] ?? null;
    }

    private function authorizedHttp(Client $client): ClientInterface
    {
        return $client->authorize();
    }

    private function persistToken(array $token, ?string $fallbackRefreshToken): void
    {
        $token['refresh_token'] ??= $fallbackRefreshToken;
        $token['created'] ??= now()->timestamp;

        GoogleToken::current()->update([
            'access_token' => $token['access_token'] ?? null,
            'refresh_token' => $token['refresh_token'],
            'token_payload' => $token,
            'expires_at' => isset($token['expires_in']) ? now()->addSeconds((int) $token['expires_in']) : null,
        ]);
    }
}
