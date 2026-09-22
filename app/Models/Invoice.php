<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_id',
        'type',
        'number',
        'issue_date',
        'customer_name',
        'total',
        'file_path',
        'status',
        'voided_at',
        'void_reason',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'total' => 'decimal:2',
            'voided_at' => 'datetime',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Carpeta de archivo (año/mes) según la fecha de emisión. */
    public function getFolderAttribute(): string
    {
        return ($this->issue_date ?? $this->created_at)->format('Y/m');
    }

    protected $appends = ['folder'];
}
