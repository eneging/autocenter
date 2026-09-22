<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkerPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'worker_id',
        'project_id',
        'registered_by',
        'period_start',
        'period_end',
        'total_hours',
        'hourly_rate',
        'total_amount',
        'advances_deducted',
        'paid_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'paid_at' => 'date',
            'total_hours' => 'decimal:2',
            'hourly_rate' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'advances_deducted' => 'decimal:2',
        ];
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(Worker::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }
}
