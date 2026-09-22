<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SunatSetting extends Model
{
    protected $fillable = ['env', 'token_production'];

    // El token nunca debe salir en una respuesta JSON, ni siquiera al admin:
    // solo se escribe, nunca se vuelve a mostrar.
    protected $hidden = ['token_production'];

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }

    public function isProduction(): bool
    {
        return $this->env === 'production';
    }

    public function hasProductionToken(): bool
    {
        return filled($this->token_production);
    }
}
