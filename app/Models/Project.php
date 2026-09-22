<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'client_id',
        'vehicle_id',
        'responsible_worker_id',
        'name',
        'type',
        'description',
        'problem_description',
        'mileage',
        'fuel_level',
        'reception_checklist',
        'client_requests_prior_budget',
        'client_authorizes_repair_without_budget',
        'client_authorizes_test_drive',
        'client_accepted_terms_at',
        'technical_diagnostic',
        'solution',
        'service_type',
        'complexity',
        'priority',
        'status',
        'starts_at',
        'estimated_delivery_at',
        'estimated_time',
        'exit_date',
        'estimated_cost',
        'budget',
        'real_cost',
        'progress',
        'cover_image_url',
        'client_access_token',
        'notes',
        'client_comment',
        'client_rating',
        'client_commented_at',
        'last_notified_status',
        'drive_folder_id',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'estimated_delivery_at' => 'date',
            'exit_date' => 'date',
            'estimated_cost' => 'decimal:2',
            'budget' => 'decimal:2',
            'real_cost' => 'decimal:2',
            'client_commented_at' => 'datetime',
            'reception_checklist' => 'array',
            'client_requests_prior_budget' => 'boolean',
            'client_authorizes_repair_without_budget' => 'boolean',
            'client_authorizes_test_drive' => 'boolean',
            'client_accepted_terms_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(Worker::class, 'responsible_worker_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(ProjectTask::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProjectMedia::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function workerPayments(): HasMany
    {
        return $this->hasMany(WorkerPayment::class);
    }

    public function trackingLogs(): HasMany
    {
        return $this->hasMany(TrackingLog::class);
    }

    public function partsRequests(): HasMany
    {
        return $this->hasMany(PartsRequest::class);
    }

    public static function nextCode(): string
    {
        $prefix = config('taller.order_prefix', 'SEG');
        $number = static::withTrashed()->count() + 1;

        do {
            $code = $prefix.'-'.now()->year.'-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT);
            $number++;
        } while (static::withTrashed()->where('code', $code)->exists());

        return $code;
    }

    protected static function booted(): void
    {
        static::saved(function (Project $project) {
            if (! $project->estimated_delivery_at) {
                return;
            }

            if (! $project->wasRecentlyCreated && ! $project->wasChanged(['estimated_delivery_at', 'name'])) {
                return;
            }

            CalendarEvent::updateOrCreate(
                ['project_id' => $project->id, 'type' => 'Entrega'],
                [
                    'title' => 'Entrega: '.$project->name,
                    'starts_at' => $project->estimated_delivery_at,
                ]
            );
        });
    }
}
