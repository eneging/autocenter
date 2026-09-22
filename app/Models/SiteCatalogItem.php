<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiteCatalogItem extends Model
{
    use HasFactory;

    protected $fillable = ['category', 'title', 'unit_label', 'price', 'description', 'measurement_hint', 'image_url', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
