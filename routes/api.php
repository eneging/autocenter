<?php

use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClientController;
use App\Http\Controllers\Api\V1\ComplaintBookController;
use App\Http\Controllers\Api\V1\FinanceController;
use App\Http\Controllers\Api\V1\CashRegisterController;
use App\Http\Controllers\Api\V1\CommissionController;
use App\Http\Controllers\Api\V1\GoogleDriveController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\PayrollAdvanceController;
use App\Http\Controllers\Api\V1\ProjectMediaController;
use App\Http\Controllers\Api\V1\PromotionController;
use App\Http\Controllers\Api\V1\PublicTrackingController;
use App\Http\Controllers\Api\V1\QuoteRequestController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ServiceOrderController;
use App\Http\Controllers\Api\V1\VehicleController;
use App\Http\Controllers\Api\V1\SegmentosController;
use App\Http\Controllers\Api\V1\SiteController;
use App\Http\Controllers\Api\V1\SunatDocumentController;
use App\Http\Controllers\Api\V1\SunatSettingController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WorkerPaymentController;
use Illuminate\Support\Facades\Route;



// routes/api.php
use App\Http\Controllers\WhatsAppWebhookController;

Route::get('/webhook/whatsapp', [WhatsAppWebhookController::class, 'verify']);
Route::post('/webhook/whatsapp', [WhatsAppWebhookController::class, 'receive']);

Route::prefix('v1')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
    Route::post('/register', [QuoteRequestController::class, 'register'])->middleware('throttle:6,1');
    Route::get('/client-portal/{token}', [PublicTrackingController::class, 'show']);
    Route::get('/tracking/{token}', [PublicTrackingController::class, 'show']);
    Route::post('/tracking/{token}/comment', [PublicTrackingController::class, 'comment'])->middleware('throttle:10,1');
    Route::get('/promotions', [PromotionController::class, 'publicIndex']);
    Route::post('/promotions/{promotion}/register', [PromotionController::class, 'register'])->middleware('throttle:10,1');
    Route::get('/site', [SiteController::class, 'show']);
    Route::get('/site/services/{slug}', [SiteController::class, 'servicesShow']);
    Route::post('/complaint-book', [ComplaintBookController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/complaint-book/{complaintBookEntry}/pdf', [ComplaintBookController::class, 'downloadPdf']);
    // Google redirige el navegador aqui tras el consentimiento; esa navegacion no trae
    // el Referer de nuestro dominio, asi que Sanctum no la reconoce como peticion con sesion.
    // Por eso queda publica: el "code" de un solo uso es la unica credencial que importa aqui.
    Route::get('/google/callback', [GoogleDriveController::class, 'callback']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);

        Route::middleware('role:Administrador')->group(function () {
            Route::get('/dashboard', [SegmentosController::class, 'dashboard']);
            Route::get('/clients', [SegmentosController::class, 'clients']);
            Route::put('/clients/{client}', [ClientController::class, 'update']);
            Route::get('/workers', [SegmentosController::class, 'workers']);
            Route::put('/workers/{worker}', [SegmentosController::class, 'updateWorker']);
            // Se mantiene solo la lista (la usan los desplegables de Finanzas y Cotizaciones);
            // la gestión de proyectos genéricos y tareas (carpintería) se dio de baja.
            Route::get('/projects', [SegmentosController::class, 'projects']);
            Route::get('/quotations', [SegmentosController::class, 'quotations']);
            Route::post('/quotations', [SegmentosController::class, 'storeQuotation']);
            Route::put('/quotations/{quotation}', [SegmentosController::class, 'updateQuotation']);
            Route::delete('/quotations/{quotation}', [SegmentosController::class, 'destroyQuotation']);
            Route::get('/quotations/{quotation}/pdf', [SegmentosController::class, 'quotationPdf']);
            Route::get('/quotations/{quotation}/contract-pdf', [SegmentosController::class, 'quotationContractPdf']);
            Route::post('/quotations/{quotation}/send-email', [SegmentosController::class, 'sendQuotationEmail']);
            Route::post('/quotations/{quotation}/sunat-document', [SunatDocumentController::class, 'store']);
            Route::post('/sunat-documents/{sunatDocument}/send-email', [SunatDocumentController::class, 'sendEmail']);
            Route::get('/sunat-settings', [SunatSettingController::class, 'show']);
            Route::put('/sunat-settings', [SunatSettingController::class, 'update']);
            Route::get('/calendar-events', [SegmentosController::class, 'calendarEvents']);

            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::post('/users/{user}/deactivate', [UserController::class, 'deactivate']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
            Route::post('/workers/{worker}/grant-access', [UserController::class, 'grantWorkerAccess']);

            Route::get('/quote-requests', [QuoteRequestController::class, 'index']);
            Route::patch('/quote-requests/{projectRequest}/status', [QuoteRequestController::class, 'updateStatus']);
            Route::post('/quote-requests/{projectRequest}/quotation', [QuoteRequestController::class, 'createQuotation']);
            Route::post('/quote-requests/{projectRequest}/approve', [QuoteRequestController::class, 'approve']);

            Route::post('/site/upload', [SiteController::class, 'upload']);
            Route::post('/site/upload-video', [SiteController::class, 'uploadVideo']);
            Route::post('/site/upload-hero-image', [SiteController::class, 'uploadHeroImage']);
            Route::get('/media-assets', [SiteController::class, 'mediaAssetsIndex']);
            Route::put('/site-settings', [SiteController::class, 'updateSettings']);

            Route::get('/site-services', [SiteController::class, 'servicesIndex']);
            Route::post('/site-services', [SiteController::class, 'servicesStore']);
            Route::put('/site-services/{siteService}', [SiteController::class, 'servicesUpdate']);
            Route::delete('/site-services/{siteService}', [SiteController::class, 'servicesDestroy']);

            Route::get('/site-testimonials', [SiteController::class, 'testimonialsIndex']);
            Route::post('/site-testimonials', [SiteController::class, 'testimonialsStore']);
            Route::put('/site-testimonials/{siteTestimonial}', [SiteController::class, 'testimonialsUpdate']);
            Route::delete('/site-testimonials/{siteTestimonial}', [SiteController::class, 'testimonialsDestroy']);

            Route::get('/site-gallery', [SiteController::class, 'galleryIndex']);
            Route::post('/site-gallery', [SiteController::class, 'galleryStore']);
            Route::put('/site-gallery/{siteGalleryItem}', [SiteController::class, 'galleryUpdate']);
            Route::delete('/site-gallery/{siteGalleryItem}', [SiteController::class, 'galleryDestroy']);

            Route::get('/site-partners', [SiteController::class, 'partnersIndex']);
            Route::post('/site-partners', [SiteController::class, 'partnersStore']);
            Route::put('/site-partners/{sitePartner}', [SiteController::class, 'partnersUpdate']);
            Route::delete('/site-partners/{sitePartner}', [SiteController::class, 'partnersDestroy']);

            Route::get('/site-videos', [SiteController::class, 'videosIndex']);
            Route::post('/site-videos', [SiteController::class, 'videosStore']);
            Route::put('/site-videos/{siteVideo}', [SiteController::class, 'videosUpdate']);
            Route::delete('/site-videos/{siteVideo}', [SiteController::class, 'videosDestroy']);

            Route::get('/site-catalog', [SiteController::class, 'catalogIndex']);
            Route::post('/site-catalog', [SiteController::class, 'catalogStore']);
            Route::put('/site-catalog/{siteCatalogItem}', [SiteController::class, 'catalogUpdate']);
            Route::delete('/site-catalog/{siteCatalogItem}', [SiteController::class, 'catalogDestroy']);

            Route::get('/finance/summary', [FinanceController::class, 'summary']);
            Route::get('/finance/ledger', [FinanceController::class, 'ledger']);
            Route::get('/finance/projects', [FinanceController::class, 'projectsProfitability']);
            Route::post('/finance/upload-receipt', [FinanceController::class, 'uploadReceipt']);
            Route::get('/finance/income-statement/pdf', [FinanceController::class, 'incomeStatementPdf']);
            Route::get('/finance/income-statement/csv', [FinanceController::class, 'incomeStatementCsv']);

            Route::get('/expenses', [FinanceController::class, 'expensesIndex']);
            Route::post('/expenses', [FinanceController::class, 'expensesStore']);
            Route::put('/expenses/{expense}', [FinanceController::class, 'expensesUpdate']);
            Route::delete('/expenses/{expense}', [FinanceController::class, 'expensesDestroy']);

            Route::get('/savings', [FinanceController::class, 'savingsIndex']);
            Route::post('/savings', [FinanceController::class, 'savingsStore']);
            Route::delete('/savings/{savingsMovement}', [FinanceController::class, 'savingsDestroy']);

            Route::post('/quotations/{quotation}/payments', [FinanceController::class, 'quotationPaymentsStore']);
            Route::delete('/quotation-payments/{quotationPayment}', [FinanceController::class, 'quotationPaymentsDestroy']);

            Route::get('/google/connect', [GoogleDriveController::class, 'connect']);
            Route::get('/google/status', [GoogleDriveController::class, 'status']);
            Route::delete('/project-media/{projectMedia}', [ProjectMediaController::class, 'destroy']);

            Route::get('/attendance', [AttendanceController::class, 'index']);
            Route::put('/attendance/{attendance}', [AttendanceController::class, 'update']);
            Route::delete('/attendance/{attendance}', [AttendanceController::class, 'destroy']);

            Route::get('/complaint-book', [ComplaintBookController::class, 'index']);
            Route::put('/complaint-book/{complaintBookEntry}/respond', [ComplaintBookController::class, 'respond']);

            // Taller: vehículos y recepción de órdenes de servicio
            Route::get('/vehicles', [VehicleController::class, 'index']);
            Route::get('/vehicles/lookup', [VehicleController::class, 'lookup'])->middleware('throttle:40,1');
            Route::get('/vehicles/plate-usage', [VehicleController::class, 'plateUsage']);
            Route::get('/vehicles/{vehicle}', [VehicleController::class, 'show']);
            Route::post('/vehicles', [VehicleController::class, 'store']);
            Route::put('/vehicles/{vehicle}', [VehicleController::class, 'update']);
            Route::delete('/vehicles/{vehicle}', [VehicleController::class, 'destroy']);
            Route::post('/service-orders', [ServiceOrderController::class, 'store']);
            Route::delete('/service-orders/{project}', [ServiceOrderController::class, 'destroy']);

            // Inventario (repuestos y herramientas) con QR
            Route::post('/inventory', [InventoryController::class, 'store']);
            Route::post('/inventory/scan', [InventoryController::class, 'scan']);
            Route::put('/inventory/{item}', [InventoryController::class, 'update']);
            Route::delete('/inventory/{item}', [InventoryController::class, 'destroy']);
            Route::post('/inventory/{item}/movements', [InventoryController::class, 'movement']);
            Route::get('/inventory/{item}/qr', [InventoryController::class, 'qr']);

            // Caja diaria, comisiones, comprobantes y reportes
            Route::get('/cash-registers/options', [CashRegisterController::class, 'options']);
            Route::get('/cash-registers/current', [CashRegisterController::class, 'current']);
            Route::get('/cash-registers', [CashRegisterController::class, 'index']);
            Route::post('/cash-registers', [CashRegisterController::class, 'open']);
            Route::get('/cash-registers/{cashRegister}', [CashRegisterController::class, 'show']);
            Route::post('/cash-registers/{cashRegister}/close', [CashRegisterController::class, 'close']);
            Route::post('/cash-registers/{cashRegister}/transactions', [CashRegisterController::class, 'storeTransaction']);
            Route::put('/transactions/{transaction}', [CashRegisterController::class, 'updateTransaction']);
            Route::delete('/transactions/{transaction}', [CashRegisterController::class, 'destroyTransaction']);
            Route::get('/commissions', [CommissionController::class, 'index']);
            Route::post('/commissions/pay', [CommissionController::class, 'pay']);
            Route::get('/invoices', [InvoiceController::class, 'index']);
            Route::get('/invoices/folders', [InvoiceController::class, 'folders']);
            Route::post('/invoices', [InvoiceController::class, 'store']);
            Route::post('/invoices/{invoice}/void', [InvoiceController::class, 'void']);
            Route::get('/invoices/{invoice}/download', [InvoiceController::class, 'download']);
            Route::get('/reports/{period}', [ReportController::class, 'show']);
            Route::get('/reports/{period}/export', [ReportController::class, 'export']);

            // Personal: adelantos de sueldo y asistencia por QR
            Route::get('/payroll-advances', [PayrollAdvanceController::class, 'index']);
            Route::post('/payroll-advances/{advance}/approve', [PayrollAdvanceController::class, 'approve']);
            Route::post('/payroll-advances/{advance}/reject', [PayrollAdvanceController::class, 'reject']);
            Route::post('/payroll-advances/{advance}/pay', [PayrollAdvanceController::class, 'pay']);
            Route::get('/attendance/qr', [AttendanceController::class, 'qrCurrent']);
            Route::post('/attendance/qr', [AttendanceController::class, 'qrGenerate']);
            Route::post('/attendance/qr/{attendanceQrCode}/revoke', [AttendanceController::class, 'qrRevoke']);

            // Captación: eventos, sorteos y cupones
            Route::get('/admin/promotions', [PromotionController::class, 'index']);
            Route::post('/admin/promotions', [PromotionController::class, 'store']);
            Route::put('/admin/promotions/{promotion}', [PromotionController::class, 'update']);
            Route::delete('/admin/promotions/{promotion}', [PromotionController::class, 'destroy']);
            Route::get('/admin/promotions/{promotion}/entries', [PromotionController::class, 'entries']);
            Route::post('/admin/promotions/{promotion}/draw', [PromotionController::class, 'draw']);
            Route::post('/promotion-entries/{entry}/redeem', [PromotionController::class, 'redeem']);
            Route::get('/coupons/lookup', [PromotionController::class, 'lookupCoupon']);

            Route::get('/workers/{worker}/payment-summary', [WorkerPaymentController::class, 'summary']);
            Route::get('/worker-payments', [WorkerPaymentController::class, 'index']);
            Route::post('/worker-payments', [WorkerPaymentController::class, 'store']);
            Route::delete('/worker-payments/{workerPayment}', [WorkerPaymentController::class, 'destroy']);
        });

        Route::middleware('role:Administrador|Community Manager')->group(function () {
            Route::get('/content-library', [ProjectMediaController::class, 'library']);
        });

        // Órdenes de servicio: el técnico solo ve/gestiona las suyas (se valida en el controlador).
        Route::middleware('role:Administrador|Trabajador')->group(function () {
            Route::get('/reception-options', [ServiceOrderController::class, 'receptionOptions']);
            Route::get('/service-orders', [ServiceOrderController::class, 'index']);
            Route::get('/service-orders/{project}', [ServiceOrderController::class, 'show']);
            Route::put('/service-orders/{project}', [ServiceOrderController::class, 'update']);
            Route::patch('/service-orders/{project}/status', [ServiceOrderController::class, 'updateStatus']);
            Route::post('/service-orders/{project}/logs', [ServiceOrderController::class, 'storeLog']);
            Route::delete('/service-orders/{project}/logs/{log}', [ServiceOrderController::class, 'destroyLog']);
            Route::post('/service-orders/{project}/parts', [ServiceOrderController::class, 'storePart']);
            Route::delete('/service-orders/{project}/parts/{part}', [ServiceOrderController::class, 'destroyPart']);
            Route::get('/service-orders/{project}/tracking-link', [ServiceOrderController::class, 'trackingLink']);
            Route::get('/service-orders/{project}/reception-pdf', [ServiceOrderController::class, 'receptionPdf']);
            Route::get('/inventory', [InventoryController::class, 'index']);
            Route::get('/inventory/{item}', [InventoryController::class, 'show']);
        });

        Route::middleware('role:Trabajador')->group(function () {
            Route::get('/my-advances', [PayrollAdvanceController::class, 'mine']);
            Route::post('/my-advances', [PayrollAdvanceController::class, 'request']);

            Route::get('/my-attendance', [AttendanceController::class, 'myStatus']);
            Route::post('/my-attendance/scan', [AttendanceController::class, 'myScan']);
            Route::post('/my-attendance/break-start', [AttendanceController::class, 'breakStart']);
            Route::post('/my-attendance/break-end', [AttendanceController::class, 'breakEnd']);
        });

        Route::middleware('role:Cliente')->group(function () {
            Route::get('/my-projects', [SegmentosController::class, 'myProjects']);
            Route::get('/my-requests', [QuoteRequestController::class, 'myRequests']);
        });
    });
});
