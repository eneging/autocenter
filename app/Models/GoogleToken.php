<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoogleToken extends Model
{
    protected $fillable = [
        'access_token',
        'refresh_token',
        'token_payload',
        'expires_at',
        'connected_email',
        'root_folder_id',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'token_payload' => 'array',
        ];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }
}
