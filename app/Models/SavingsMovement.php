<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavingsMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'direction',
        'amount',
        'movement_date',
        'notes',
        'registered_by',
    ];

    protected function casts(): array
    {
        return [
            'movement_date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registered_by');
    }
}
