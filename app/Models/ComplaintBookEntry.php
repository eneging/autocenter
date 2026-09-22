<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ComplaintBookEntry extends Model
{
    use HasFactory;

    protected $appends = ['code', 'plazo_respuesta'];

    protected $fillable = [
        'tipo',
        'bien_tipo',
        'monto_reclamado',
        'bien_descripcion',
        'consumidor_nombre',
        'consumidor_domicilio',
        'consumidor_documento',
        'consumidor_telefono',
        'consumidor_email',
        'es_menor',
        'representante_nombre',
        'detalle',
        'pedido',
        'enviar_copia_email',
        'consumidor_ip',
        'consumidor_acepta_at',
        'respuesta_texto',
        'respuesta_fecha',
        'estado',
    ];

    protected function casts(): array
    {
        return [
            'es_menor' => 'boolean',
            'enviar_copia_email' => 'boolean',
            'monto_reclamado' => 'decimal:2',
            'consumidor_acepta_at' => 'datetime',
            'respuesta_fecha' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $entry) {
            $entry->access_token ??= Str::random(32);
        });
    }

    public function getCodeAttribute(): string
    {
        $year = $this->created_at?->year ?? now()->year;

        return sprintf('%09d-%d', $this->id, $year);
    }

    /** Plazo legal improrrogable: 15 dias habiles desde el registro (Art. 6 del Reglamento, modificado por DS 101-2022-PCM). */
    public function getPlazoRespuestaAttribute(): \Carbon\Carbon
    {
        $date = $this->created_at?->copy() ?? now();
        $added = 0;
        while ($added < 15) {
            $date->addDay();
            if (!$date->isWeekend()) {
                $added++;
            }
        }

        return $date;
    }
}
