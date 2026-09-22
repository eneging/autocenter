<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SunatDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'quotation_id',
        'tipo',
        'serie',
        'numero',
        'moneda',
        'estado',
        'entorno',
        'mensaje',
        'hash',
        'xml_url',
        'cdr_url',
        'pdf_ticket_url',
        'pdf_a4_url',
        'payload',
        'issued_by',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
