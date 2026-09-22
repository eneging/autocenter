<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Worker extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'name', 'role', 'phone', 'is_active', 'hourly_rate'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'hourly_rate' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'responsible_worker_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(WorkerPayment::class);
    }

    public function payrollAdvances(): HasMany
    {
        return $this->hasMany(PayrollAdvance::class);
    }
}
