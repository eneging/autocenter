<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'plate',
        'brand',
        'model',
        'year',
        'color',
        'vin',
        'engine_number',
        'next_maintenance_at',
        'maintenance_reminded_for',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'next_maintenance_at' => 'date',
            'maintenance_reminded_for' => 'date',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
