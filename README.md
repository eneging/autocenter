# Calle Auto Center

Sistema de gestión y sitio web para un taller de reparación de vehículos. Backend **Laravel 12** (API + Sanctum + Spatie Permission) y frontend **React + Vite + TypeScript** (SPA), sobre **MySQL**.

Nació como base "Segmentos" (remodelación); todo lo de ese sistema sigue disponible (cotizaciones, proyectos, finanzas, SUNAT, libro de reclamaciones, CMS del sitio, Google Drive) y se agregó el dominio de taller.

## Módulos del taller

| Módulo | Qué hace |
| --- | --- |
| Órdenes de servicio | Recepción (DNI/RUC, placa, problema), ficha técnica (diagnóstico, solución, presupuesto, tiempos, tipo), estados Pendiente / En Proceso / Finalizado. |
| Seguimiento por enlace | `/seguimiento/{token}` (alias `/tracking/{token}`): timeline con fotos con marca de agua, recibo al finalizar y formulario de comentario. Solo expone datos seguros. |
| Vehículos | Un dueño, varios vehículos; historial de órdenes; próxima fecha de mantenimiento. |
| Inventario | Repuestos y herramientas, QR con todos los datos, entradas/salidas por escaneo o código, costos editables, IGV 18 %. |
| Caja | Apertura/cierre diario, ingresos por Yape / efectivo / transferencia, gastos fijos y variables, IGV, comisiones por técnico. |
| Comprobantes | Archivo de boletas y facturas en carpetas año/mes, con baja. |
| Reportes | Diario, semanal y mensual en JSON, PDF (DomPDF) y Excel (Laravel Excel). |
| Personal | Asistencia por QR, adelantos de sueldo (solicitud → aprobación → entrega → descuento en planilla). |
| Captación | Eventos, sorteos y cupones de descuento con registro público. |
| WhatsApp | Avisos de cambio de estado, recordatorios de mantenimiento y asistente (Claude). |

Roles: `Administrador` (todo), `Trabajador` (técnico: solo sus órdenes, su asistencia y sus adelantos), `Cliente`, `Community Manager`.

## Requisitos

- PHP 8.2+ con extensiones: `pdo_mysql`, `mbstring`, `fileinfo`, `gd`, `zip`, `intl`, `openssl`, `curl`
- MySQL 8 / MariaDB 10.4+
- Composer 2 y Node 22+ (solo para compilar)

## Instalación local

```bash
composer install
cp .env.example .env          # ajusta DB_*, APP_URL y las claves que uses
php artisan key:generate
php artisan migrate
php artisan db:seed           # crea roles y el administrador (muestra la contraseña si no defines SEED_ADMIN_PASSWORD)
npm ci && npm run build       # o `npm run dev` para desarrollo
php artisan serve
```

`SEED_DEMO=true php artisan db:seed` agrega un técnico, inventario y una promoción de ejemplo. `SEED_PROFILE=segmentos` carga los datos demo del sistema original.

## Despliegue (producción)

1. Sube el código y ejecuta:
   ```bash
   composer install --no-dev --optimize-autoloader
   npm ci && npm run build
   php artisan migrate --force
   php artisan db:seed --force          # solo la primera vez
   php artisan config:cache && php artisan route:cache && php artisan view:cache
   ```
2. `.env` de producción: `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://tu-dominio`, `SANCTUM_STATEFUL_DOMAINS=tu-dominio`, `SESSION_DOMAIN`, credenciales de base de datos y `SEED_ADMIN_PASSWORD` (o guarda la generada).
3. El servidor web debe apuntar a `public/` y `storage/` y `bootstrap/cache/` deben ser escribibles.
4. **Scheduler** (recordatorios de mantenimiento a las 09:00): agrega al cron
   ```
   * * * * * cd /ruta/proyecto && php artisan schedule:run >> /dev/null 2>&1
   ```
5. **Cola**: `QUEUE_CONNECTION=database`; si usas jobs, mantén `php artisan queue:work` con supervisor.
6. Los comprobantes se guardan en el disco `INVOICES_DISK` (privado, `storage/app/private`). Incluye esa carpeta en tus respaldos o usa `s3`.
7. HTTPS es obligatorio para que la cámara (lector QR) funcione en los celulares.

### Integraciones (todas opcionales; sin claves la función correspondiente se desactiva sin romper nada)

| Variables | Para qué |
| --- | --- |
| `CLOUDINARY_*`, `WATERMARK_TEXT`, `WATERMARK_LOGO_PUBLIC_ID` | Subida de fotos del seguimiento con marca de agua (texto = nombre de la empresa por defecto). |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Avisos, recordatorios y webhook (`/api/webhook/whatsapp`). |
| `ANTHROPIC_API_KEY` | Asistente por WhatsApp. |
| `JSONPE_TOKEN` (`JSONPE_URL`, `PLATE_LOOKUP_CACHE_DAYS`) | Consulta de placas en [json.pe](https://docs.json.pe): autocompleta marca, modelo, color, serie y motor al registrar un vehículo. Cada placa se consulta una vez y se guarda en caché (30 días por defecto). |
| `GOOGLE_*` | Biblioteca de medios en Drive. |
| `SUNAT_*` | Facturación electrónica (flujo de cotizaciones). |
| `BRAND_LOGO_URL`, `VITE_LOGO_URL`, `VITE_APP_NAME` | Logo y nombre en PDFs, favicon y panel (`VITE_*` requiere recompilar). |
| `ORDER_CODE_PREFIX`, `IGV_RATE`, `TRACKING_BASE_URL` | Prefijo de órdenes, tasa de IGV y URL base de los enlaces enviados. |

Las reglas de negocio configurables (estados, tipos de servicio, categorías de caja, escalones de comisión) están en [config/taller.php](config/taller.php).

## Calidad

```bash
php artisan test        # requiere una base MySQL "calleautocenter_test" (ver phpunit.xml)
npx tsc --noEmit        # tipos del frontend (strict)
npm run build
vendor/bin/pint --test
```
# autocenter
# autocenter
