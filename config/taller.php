<?php

return [

    'order_prefix' => env('ORDER_CODE_PREFIX', 'CAC'),

    // Logo (URL absoluta) para PDFs y favicon. Si está vacío, los PDFs salen sin logo y el favicon es /favicon.ico.
    'logo_url' => env('BRAND_LOGO_URL'),

    'igv_rate' => (float) env('IGV_RATE', 0.18),

    // Estados de una orden de servicio. "Finalizado" cierra la orden (fecha de salida + recibo).
    'order_statuses' => ['Pendiente', 'En Proceso', 'Finalizado'],
    'closed_status' => 'Finalizado',

    'service_types' => ['Mantenimiento eléctrico', 'Reparación'],

    'payment_methods' => ['Yape', 'Efectivo', 'Transferencia'],

    'income_categories' => ['Servicio', 'Repuestos', 'Otro ingreso'],

    'fixed_expense_categories' => [
        'Luz', 'Agua', 'Internet', 'Alquiler', 'Sueldos', 'Contadora', 'SUNAT',
        'Alimentación personal', 'Préstamos', 'Comisiones',
    ],

    'variable_expense_categories' => ['Gasolina', 'Repuestos', 'Agua extra', 'Otro gasto'],

    // Comisión por generación de ingresos de cada técnico en el período consultado.
    // Se aplica el escalón más alto alcanzado (mínimo de ingresos => comisión en soles).
    'commission_tiers' => [
        ['min' => 2000, 'amount' => 200],
        ['min' => 1500, 'amount' => 200],
        ['min' => 1000, 'amount' => 100],
    ],

    'whatsapp' => [
        'country_code' => env('WHATSAPP_COUNTRY_CODE', '51'),
        'maintenance_days_before' => (int) env('MAINTENANCE_REMINDER_DAYS', 3),
        // Public ID en Cloudinary del logo que se estampa como marca de agua (opcional).
        'tracking_base_url' => env('TRACKING_BASE_URL'),
    ],

    'watermark' => [
        'logo_public_id' => env('WATERMARK_LOGO_PUBLIC_ID'),
        'text' => env('WATERMARK_TEXT'),
    ],

    'invoices_disk' => env('INVOICES_DISK', 'local'),

    /*
    | Recepción del vehículo: la revisión detallada que se llena al ingresar el auto
    | y que se imprime en la orden de servicio (reemplaza el diagrama a mano del formato en papel
    | por una lista de zonas con su estado).
    */
    'reception' => [
        'fuel_levels' => ['Vacío', '1/4', '1/2', '3/4', 'Lleno'],

        'exterior_items' => [
            'Vidrios / lunas', 'Radio / equipo multimedia', 'Pantalla / GPS', 'Pintura / carrocería',
            'Parachoques delantero', 'Parachoques trasero', 'Faros delanteros', 'Focos traseros',
            'Luces direccionales', 'Luz de freno', 'Luz de emergencia', 'Luz de placa',
            'Espejo derecho', 'Espejo izquierdo', 'Antena', 'Tapas de ruedas',
            'Limpiaparabrisas', 'Placas', 'Tapetes', 'Tapa de gasolina',
        ],

        'tool_items' => [
            'Herramientas (kit)', 'Llanta de repuesto', 'Gata (jack)', 'Llave de ruedas',
            'Extintor', 'Triángulo de seguridad', 'Botiquín', 'Tarjeta de propiedad', 'SOAT',
        ],

        // Estado general (Bueno / Regular / Malo).
        'level_items' => ['Nivel de aceite', 'Batería', 'Estado de llantas'],
        'level_options' => ['Bueno', 'Regular', 'Malo'],

        // Reemplaza el diagrama del vehículo del formato en papel: por zona se indica si hay daños y una nota.
        'damage_zones' => ['Frontal', 'Trasera', 'Lateral izquierdo', 'Lateral derecho', 'Techo', 'Interior'],

        'pickup_hours' => (int) env('RECEPTION_PICKUP_HOURS', 48),
        'storage_fee_per_day' => (float) env('RECEPTION_STORAGE_FEE', 20),

        'liability_text' => 'El taller y sus empleados no se responsabilizan por objetos dejados dentro del vehículo que no hayan sido inventariados y entregados al recepcionista.',
    ],
];
