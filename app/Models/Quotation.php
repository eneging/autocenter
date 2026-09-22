<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quotation extends Model
{
    use HasFactory;

    protected $appends = ['paid_amount', 'balance_due', 'payment_status'];

    protected $fillable = [
        'number',
        'client_id',
        'project_id',
        'status',
        'issue_date',
        'delivery_time',
        'subtotal',
        'igv',
        'includes_igv',
        'total',
        'advance_percentage',
        'extra_terms',
        'conditions',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'subtotal' => 'decimal:2',
            'igv' => 'decimal:2',
            'includes_igv' => 'boolean',
            'total' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function sunatDocuments(): HasMany
    {
        return $this->hasMany(SunatDocument::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(QuotationPayment::class);
    }

    protected function paidAmount(): Attribute
    {
        return Attribute::make(get: fn () => round((float) $this->payments->sum('amount'), 2));
    }

    protected function balanceDue(): Attribute
    {
        return Attribute::make(get: fn () => round((float) $this->total - $this->paid_amount, 2));
    }

    protected function paymentStatus(): Attribute
    {
        return Attribute::make(get: function () {
            if ($this->paid_amount <= 0) {
                return 'Pendiente';
            }

            return $this->balance_due > 0.01 ? 'Parcial' : 'Pagado';
        });
    }
}
