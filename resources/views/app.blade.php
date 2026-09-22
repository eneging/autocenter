<!doctype html>
<html lang="es">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{{ config('app.name') }}</title>
        <link rel="icon" href="{{ config('taller.logo_url') ?: asset('favicon.ico') }}">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
    </head>
    <body>
        {{-- Pantalla de carga inicial (antes de que React monte); React la reemplaza al renderizar. --}}
        <div id="root">
            <div class="loading-screen" style="position:fixed;inset:0;display:grid;place-items:center;background:#ffd400">
                @if(config('taller.logo_url'))
                    <img class="loading-logo-mark" src="{{ config('taller.logo_url') }}" alt="{{ config('app.name') }}" style="width:min(320px,70vw);height:auto">
                @endif
            </div>
        </div>
    </body>
</html>
