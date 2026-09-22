<!doctype html>
<html lang="es">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?php echo e(config('app.name')); ?></title>
        <link rel="icon" href="<?php echo e(config('taller.logo_url') ?: asset('favicon.ico')); ?>">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <?php echo app('Illuminate\Foundation\Vite')->reactRefresh(); ?>
        <?php echo app('Illuminate\Foundation\Vite')(['resources/css/app.css', 'resources/js/app.tsx']); ?>
    </head>
    <body>
        
        <div id="root">
            <div class="loading-screen" style="position:fixed;inset:0;display:grid;place-items:center;background:#ffd400">
                <?php if(config('taller.logo_url')): ?>
                    <img class="loading-logo-mark" src="<?php echo e(config('taller.logo_url')); ?>" alt="<?php echo e(config('app.name')); ?>" style="width:min(320px,70vw);height:auto">
                <?php endif; ?>
            </div>
        </div>
    </body>
</html>
<?php /**PATH C:\Users\LENOVO\Desktop\trabajo\calleautocenter\calleautocenter\resources\views/app.blade.php ENDPATH**/ ?>