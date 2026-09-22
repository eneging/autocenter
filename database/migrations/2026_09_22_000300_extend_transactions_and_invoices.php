<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('worker_id')->nullable()->after('project_id')->constrained()->nullOnDelete();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('number')->nullable()->after('type');
            $table->date('issue_date')->nullable()->after('number');
            $table->string('customer_name')->nullable()->after('issue_date');
            $table->decimal('total', 12, 2)->nullable()->after('customer_name');
            $table->dateTime('voided_at')->nullable()->after('status');
            $table->string('void_reason')->nullable()->after('voided_at');
            $table->foreignId('uploaded_by')->nullable()->after('void_reason')->constrained('users')->nullOnDelete();
        });

        Schema::table('worker_payments', function (Blueprint $table) {
            $table->decimal('advances_deducted', 12, 2)->default(0)->after('total_amount');
        });
    }

    public function down(): void
    {
        Schema::table('worker_payments', function (Blueprint $table) {
            $table->dropColumn('advances_deducted');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('uploaded_by');
            $table->dropColumn(['number', 'issue_date', 'customer_name', 'total', 'voided_at', 'void_reason']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('worker_id');
        });
    }
};
