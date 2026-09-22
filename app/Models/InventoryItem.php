<?php

namespace App\Models;

use App\Support\Igv;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'code',
        'name',
        'stock',
        'min_stock',
        'unit_cost',
        'sale_price',
        'includes_igv',
        'qr_data',
    ];

    protected $appends = ['cost_breakdown', 'price_breakdown', 'is_low_stock'];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
            'sale_price' => 'decimal:2',
            'includes_igv' => 'boolean',
        ];
    }

    public function partsRequests(): HasMany
    {
        return $this->hasMany(PartsRequest::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    /** Precio que se cobra al cliente por unidad: el precio definido o, en su defecto, el costo. */
    public function chargePrice(): float
    {
        return (float) ($this->sale_price ?? $this->unit_cost);
    }

    public function getCostBreakdownAttribute(): array
    {
        return Igv::breakdown((float) $this->unit_cost, $this->includes_igv);
    }

    public function getPriceBreakdownAttribute(): array
    {
        return Igv::breakdown($this->chargePrice(), $this->includes_igv);
    }

    public function getIsLowStockAttribute(): bool
    {
        return $this->type === 'Repuesto' && $this->stock <= $this->min_stock;
    }
}
