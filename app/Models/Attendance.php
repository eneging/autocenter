<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use HasFactory;

    protected $fillable = ['worker_id', 'date', 'clock_in', 'break_start', 'break_end', 'clock_out', 'worker_payment_id'];

    protected $appends = ['worked_hours'];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'clock_in' => 'datetime',
            'break_start' => 'datetime',
            'break_end' => 'datetime',
            'clock_out' => 'datetime',
        ];
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(Worker::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(WorkerPayment::class, 'worker_payment_id');
    }

    protected function workedHours(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (! $this->clock_out) {
                    return null;
                }

                $minutes = $this->clock_in->diffInMinutes($this->clock_out);

                if ($this->break_start && $this->break_end) {
                    $minutes -= $this->break_start->diffInMinutes($this->break_end);
                }

                return round(max($minutes, 0) / 60, 2);
            },
        );
    }
}
