<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectMedia;
use App\Services\GoogleDriveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectMediaController extends Controller
{
    public function __construct(private readonly GoogleDriveService $drive)
    {
    }

    public function index(Project $project): JsonResponse
    {
        return response()->json($project->media()->latest()->get());
    }

    public function store(Project $project, Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasRole('Trabajador') && ! $user->hasRole('Administrador')) {
            $worker = $user->worker;
            if (! $worker || $project->responsible_worker_id !== $worker->id) {
                abort(403, 'Solo puedes subir contenido de tus proyectos asignados.');
            }
        }

        $request->validate([
            'file' => ['required', 'file', 'max:204800', 'mimetypes:image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/quicktime,video/webm'],
        ]);

        $file = $request->file('file');
        $folderId = $this->drive->ensureProjectFolder($project);
        $uploaded = $this->drive->uploadFile($file, $folderId);
        $isVideo = str_starts_with($file->getMimeType(), 'video/');

        $media = ProjectMedia::create([
            'project_id' => $project->id,
            'uploaded_by' => $user->id,
            'type' => $isVideo ? 'video' : 'image',
            'drive_file_id' => $uploaded['id'],
            'drive_view_link' => $uploaded['webViewLink'] ?? '',
            // thumbnailLink de Google suele venir vacio justo despues de subir (se genera async),
            // asi que para imagenes usamos el CDN de contenido directo, que sirve el archivo al toque
            // siempre que el permiso "anyone/reader" ya este puesto (ver GoogleDriveService::uploadFile).
            'drive_thumbnail_link' => $isVideo ? null : "https://lh3.googleusercontent.com/d/{$uploaded['id']}",
        ]);

        return response()->json($media, 201);
    }

    public function destroy(ProjectMedia $projectMedia): JsonResponse
    {
        $this->drive->deleteFile($projectMedia->drive_file_id);
        $projectMedia->delete();

        return response()->json(status: 204);
    }

    public function library(): JsonResponse
    {
        return response()->json(
            ProjectMedia::whereHas('project')->with('project:id,code,name')->latest()->get()
        );
    }
}
