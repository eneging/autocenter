<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\QuotationMail;
use App\Models\ActivityLog;
use App\Models\CalendarEvent;
use App\Models\CashRegister;
use App\Models\Client;
use App\Models\InventoryItem;
use App\Models\PayrollAdvance;
use App\Models\Project;
use App\Models\ProjectTask;
use App\Models\Quotation;
use App\Models\SiteSetting;
use App\Models\Worker;
use App\Services\CloudinaryUploader;
use App\Services\FinanceService;
use App\Services\QuotationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SegmentosController extends Controller
{
    public function __construct(
        private readonly CloudinaryUploader $uploader,
        private readonly QuotationService $quotationService,
        private readonly FinanceService $financeService,
    ) {
    }

    public function dashboard(): JsonResponse
    {
        $projects = Project::with(['client', 'responsible', 'tasks'])->get();
        $active = $projects->whereNotIn('status', ['Entregado', 'Finalizado']);
        $today = Carbon::today();
        $monthTotals = $this->financeService->rangeTotals(Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth());

        return response()->json([
            'metrics' => [
                'totalProjects' => $projects->count(),
                'activeProjects' => $active->count(),
                'finishedProjects' => $projects->where('status', 'Entregado')->count(),
                'delayedProjects' => $active->filter(fn (Project $project) => $project->estimated_delivery_at?->lt($today))->count(),
                'pendingQuotations' => Quotation::where('status', 'Pendiente')->count(),
                'activeWorkers' => Worker::where('is_active', true)->count(),
                'monthIncome' => $monthTotals['income_total'],
                'monthExpenses' => $monthTotals['outflow_total'],
                'vehiclesInShop' => Project::whereNotNull('vehicle_id')->where('status', '!=', config('taller.closed_status'))->count(),
                'lowStockItems' => InventoryItem::where('type', 'Repuesto')->whereColumn('stock', '<=', 'min_stock')->count(),
                'openCashRegister' => CashRegister::where('status', 'Abierta')->exists(),
                'pendingAdvances' => PayrollAdvance::where('status', 'Pendiente')->count(),
            ],
            'priorityList' => $active->sortByDesc(fn (Project $project) => $this->priorityScore($project))->values()->take(6),
            'recentActivity' => ActivityLog::latest()->take(8)->get(),
            'upcomingDeadlines' => $active->sortBy('estimated_delivery_at')->values()->take(6),
            'chart' => $this->financeService->monthlySeries(6),
        ]);
    }

    public function clients(): JsonResponse
    {
        return response()->json(Client::withCount(['projects', 'quotations'])->latest()->get());
    }

    public function workers(): JsonResponse
    {
        return response()->json(Worker::where('is_active', true)->get());
    }

    public function updateWorker(Worker $worker, Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:40'],
            'hourly_rate' => ['required', 'numeric', 'min:0'],
            'is_active' => ['required', 'boolean'],
        ]);

        $worker->update($data);

        return response()->json($worker);
    }

    public function projects(): JsonResponse
    {
        return response()->json(Project::with(['client', 'responsible', 'tasks'])->latest()->get());
    }

    public function storeProject(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'client_id' => ['required', 'exists:clients,id'],
            'type' => ['required', 'string'],
            'complexity' => ['required', 'string'],
            'priority' => ['required', 'string'],
            'estimated_delivery_at' => ['required', 'date', 'after_or_equal:today'],
        ]);

        $project = Project::create([
            ...$data,
            'code' => Project::nextCode(),
            'status' => 'Pendiente',
            'progress' => 8,
            'client_access_token' => Str::random(40),
            'cover_image_url' => 'https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?auto=format&fit=crop&w=900&q=80',
        ]);

        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Nuevo proyecto creado',
            'description' => $project->name,
        ]);

        return response()->json($project->load(['client', 'responsible', 'tasks']), 201);
    }

    public function updateProject(Project $project, Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'client_id' => ['required', 'exists:clients,id'],
            'type' => ['required', 'string'],
            'complexity' => ['required', 'string'],
            'priority' => ['required', 'string'],
            'estimated_delivery_at' => ['required', 'date'],
            'description' => ['nullable', 'string'],
            'responsible_worker_id' => ['nullable', 'exists:workers,id'],
            'estimated_cost' => ['nullable', 'numeric', 'min:0'],
        ]);

        $project->update($data);

        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Proyecto editado',
            'description' => $project->name,
        ]);

        return response()->json($project->load(['client', 'responsible', 'tasks']));
    }

    public function updateProjectNotes(Project $project, Request $request): JsonResponse
    {
        $data = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $project->update($data);

        return response()->json($project->load(['client', 'responsible', 'tasks']));
    }

    public function updateTaskStatus(ProjectTask $projectTask, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:Pendiente,En progreso,Terminada'],
        ]);

        $projectTask->update($data);

        return response()->json($projectTask->load('project'));
    }

    public function storeTask(Project $project, Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'worker_id' => ['nullable', 'exists:workers,id'],
        ]);

        $task = ProjectTask::create([
            'project_id' => $project->id,
            'worker_id' => $data['worker_id'] ?? $project->responsible_worker_id,
            'title' => $data['title'],
            'status' => 'Pendiente',
        ]);

        return response()->json($task, 201);
    }

    public function updateTaskWorker(ProjectTask $projectTask, Request $request): JsonResponse
    {
        $data = $request->validate([
            'worker_id' => ['nullable', 'exists:workers,id'],
        ]);

        $projectTask->update($data);

        return response()->json($projectTask->fresh());
    }

    public function destroyTask(ProjectTask $projectTask): JsonResponse
    {
        $projectTask->delete();

        return response()->json(status: 204);
    }

    public function destroyProject(Project $project): JsonResponse
    {
        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Proyecto eliminado',
            'description' => $project->name,
        ]);

        $project->delete();

        return response()->json(status: 204);
    }

    public function uploadProjectImage(Project $project, Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif', 'max:10240'],
        ]);

        $user = $request->user();
        if ($user->hasRole('Trabajador') && ! $user->hasRole('Administrador')) {
            $worker = $user->worker;
            if (! $worker || $project->responsible_worker_id !== $worker->id) {
                abort(403, 'Solo puedes subir fotos de tus proyectos asignados.');
            }
        }

        $url = $this->uploader->upload($request->file('image'), 'segmentos/projects');

        $project->update(['cover_image_url' => $url]);

        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Foto de proyecto actualizada',
            'description' => $project->name,
        ]);

        return response()->json($project->load(['client', 'responsible', 'tasks']));
    }

    public function updateProjectStatus(Project $project, Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasRole('Trabajador') && ! $user->hasRole('Administrador')) {
            $worker = $user->worker;
            if (! $worker || $project->responsible_worker_id !== $worker->id) {
                abort(403, 'Solo puedes actualizar el estado de tus proyectos asignados.');
            }
        }

        $data = $request->validate([
            'status' => ['required', 'string', 'max:80'],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        $project->update([
            'status' => $data['status'],
            'progress' => $data['progress'] ?? $project->progress,
        ]);

        ActivityLog::create([
            'project_id' => $project->id,
            'title' => 'Estado actualizado',
            'description' => "{$project->code} ahora esta en {$project->status}",
        ]);

        return response()->json($project->load(['client', 'responsible', 'tasks']));
    }

    public function quotations(): JsonResponse
    {
        return response()->json(
            Quotation::with(['client', 'project' => fn ($query) => $query->withTrashed(), 'items', 'sunatDocuments', 'payments'])
                ->latest()
                ->get()
        );
    }

    public function storeQuotation(Request $request): JsonResponse
    {
        $data = $request->validate($this->quotationValidationRules());

        $quotation = $this->quotationService->create($data);

        ActivityLog::create([
            'project_id' => $quotation->project_id,
            'title' => 'Cotizacion generada',
            'description' => $quotation->number,
        ]);

        return response()->json($quotation->load(['client', 'project', 'items', 'payments']), 201);
    }

    public function updateQuotation(Quotation $quotation, Request $request): JsonResponse
    {
        $data = $request->validate($this->quotationValidationRules());

        $quotation = $this->quotationService->update($quotation, $data);

        ActivityLog::create([
            'project_id' => $quotation->project_id,
            'title' => 'Cotizacion editada',
            'description' => $quotation->number,
        ]);

        return response()->json($quotation->load(['client', 'project', 'items', 'sunatDocuments', 'payments']));
    }

    public function destroyQuotation(Quotation $quotation): JsonResponse
    {
        $number = $quotation->number;
        $projectId = $quotation->project_id;

        $this->quotationService->delete($quotation);

        ActivityLog::create([
            'project_id' => $projectId,
            'title' => 'Cotizacion eliminada',
            'description' => $number,
        ]);

        return response()->json(status: 204);
    }

    private function quotationValidationRules(): array
    {
        return [
            'client_id' => ['required', 'exists:clients,id'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'delivery_time' => ['required', 'string', 'max:255'],
            'advance_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
            'extra_terms' => ['nullable', 'string', 'max:2000'],
            'includes_igv' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.title' => ['required', 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string', 'max:2000'],
            'items.*.amount' => ['required', 'numeric', 'min:0'],
        ];
    }

    public function calendarEvents(): JsonResponse
    {
        return response()->json(
            CalendarEvent::whereHas('project')->with('project.client')->latest('starts_at')->get()
        );
    }

    public function myTasks(Request $request): JsonResponse
    {
        $worker = $request->user()->worker;

        if (! $worker) {
            return response()->json([]);
        }

        return response()->json(
            ProjectTask::whereHas('project')->with('project.client')->where('worker_id', $worker->id)->latest()->get()
        );
    }

    public function updateMyTaskStatus(ProjectTask $projectTask, Request $request): JsonResponse
    {
        $worker = $request->user()->worker;
        if (! $worker || $projectTask->worker_id !== $worker->id) {
            abort(403, 'Esta tarea no esta asignada a ti.');
        }

        $data = $request->validate([
            'status' => ['required', 'in:Pendiente,En progreso,Terminada'],
            'real_hours' => ['nullable', 'numeric', 'min:0'],
            'comments' => ['nullable', 'string', 'max:1000'],
        ]);

        $projectTask->update($data);

        ActivityLog::create([
            'project_id' => $projectTask->project_id,
            'title' => 'Tarea actualizada',
            'description' => "{$projectTask->title} -> {$projectTask->status}",
        ]);

        return response()->json($projectTask->load('project.client'));
    }

    public function myProjects(Request $request): JsonResponse
    {
        $client = $request->user()->client;

        if (! $client) {
            return response()->json([]);
        }

        return response()->json(
            Project::with(['vehicle', 'responsible'])->where('client_id', $client->id)->latest()->get()
        );
    }

    public function quotationPdf(Quotation $quotation)
    {
        return Pdf::loadView('pdf.quotation', [
            'quotation' => $quotation->load(['client', 'project', 'items']),
            'company' => SiteSetting::current(),
            'asContract' => false,
        ])->download($quotation->number.'.pdf');
    }

    public function quotationContractPdf(Quotation $quotation)
    {
        return Pdf::loadView('pdf.quotation', [
            'quotation' => $quotation->load(['client', 'project', 'items']),
            'company' => SiteSetting::current(),
            'asContract' => true,
        ])->download($quotation->number.'-CONTRATO.pdf');
    }

    public function sendQuotationEmail(Quotation $quotation, Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['nullable', 'email']]);
        $quotation->load(['client', 'project', 'items']);
        $email = $data['email'] ?? $quotation->client->email;

        if (! $email) {
            abort(422, 'El cliente no tiene un correo registrado.');
        }

        Mail::to($email)->send(new QuotationMail($quotation));

        return response()->json(['sent_to' => $email]);
    }

    private function priorityScore(Project $project): int
    {
        $days = $project->estimated_delivery_at
            ? Carbon::today()->diffInDays($project->estimated_delivery_at, false)
            : 30;

        $score = 0;
        $score += $days < 0 ? 40 : 0;
        $score += $days >= 0 && $days <= 3 ? 30 : 0;
        $score += ['Urgente' => 25, 'Alta' => 15, 'Media' => 7, 'Baja' => 2][$project->priority] ?? 0;
        $score += ['Alta' => 12, 'Media' => 7, 'Baja' => 3][$project->complexity] ?? 0;
        $score += $project->client?->is_frequent ? 8 : 0;
        $score += $project->status === 'Instalacion' ? 10 : 0;
        $score += (int) round((100 - $project->progress) / 10);

        return $score;
    }
}
