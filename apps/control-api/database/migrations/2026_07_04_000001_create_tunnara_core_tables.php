<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active')->index();
            $table->timestampsTz();
        });

        Schema::create('agents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->string('name');
            $table->string('platform', 60);
            $table->string('architecture', 30);
            $table->string('version', 30);
            $table->text('public_key');
            $table->string('status')->default('provisioning')->index();
            $table->timestampTz('last_seen_at')->nullable();
            $table->timestampsTz();
            $table->unique(['organization_id', 'name']);
        });

        Schema::create('tunnels', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->foreignUuid('agent_id')
                ->constrained('agents')
                ->cascadeOnDelete();
            $table->string('name');
            $table->string('protocol', 30)->index();
            $table->string('target_host');
            $table->unsignedSmallInteger('target_port');
            $table->string('public_hostname')->nullable()->unique();
            $table->unsignedSmallInteger('public_port')->nullable();
            $table->string('status')->default('pending')->index();
            $table->jsonb('configuration')->nullable();
            $table->timestampsTz();
        });

        Schema::create('service_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')
                ->nullable()
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->string('name');
            $table->char('token_hash', 64)->unique();
            $table->jsonb('abilities')->nullable();
            $table->timestampTz('last_used_at')->nullable();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignUuid('organization_id')
                ->nullable()
                ->constrained('organizations')
                ->nullOnDelete();
            $table->string('actor_type')->nullable();
            $table->string('actor_id')->nullable();
            $table->string('event')->index();
            $table->string('resource_type')->nullable();
            $table->string('resource_id')->nullable();
            $table->ipAddress('ip_address')->nullable();
            $table->jsonb('context')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('service_tokens');
        Schema::dropIfExists('tunnels');
        Schema::dropIfExists('agents');
        Schema::dropIfExists('organizations');
    }
};
