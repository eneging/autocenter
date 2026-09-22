<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromotionEntry extends Model
{
    protected $fillable = [
        'promotion_id',
        'name',
        'phone',
        'email',
        'document_number',
        'coupon_code',
        'redeemed_at',
        'accepted_terms',
    ];

    protected function casts(): array
    {
        return [
            'redeemed_at' => 'datetime',
            'accepted_terms' => 'boolean',
        ];
    }

    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }
}
