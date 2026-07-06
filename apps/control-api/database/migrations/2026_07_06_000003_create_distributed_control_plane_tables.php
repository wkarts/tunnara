<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', function (Blueprint $table): void {
            $table->char('session_token_hash', 64)->nullable()->unique()->after('public_key');
            $table->timestampTz('session_expires_at')->nullable()->after('session_token_hash');
            $table->string('region')->nullable()->index()->after('status');
        });

        Schema::create('provisioning_tokens', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('name');
            $table->char('token_hash', 64)->unique();
            $table->timestampTz('expires_at');
            $table->timestampTz('used_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            $table->timestampsTz();
            $table->index(['organization_id', 'expires_at']);
        });

        Schema::create('policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('enabled')->default(true)->index();
            $table->json('definition');
            $table->unsignedInteger('revision')->default(1);
            $table->timestampsTz();
            $table->unique(['organization_id', 'name']);
        });

        Schema::table('tunnels', function (Blueprint $table): void {
            $table->foreignUuid('policy_id')->nullable()->after('agent_id')->constrained('policies')->nullOnDelete();
            $table->boolean('inspector_enabled')->default(false)->after('configuration');
            $table->unsignedInteger('inspector_body_limit')->default(65536)->after('inspector_enabled');
            $table->string('health_status')->default('unknown')->index()->after('status');
        });

        Schema::create('tunnel_targets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignUuid('tunnel_id')->constrained('tunnels')->cascadeOnDelete();
            $table->foreignUuid('agent_id')->constrained('agents')->cascadeOnDelete();
            $table->string('name')->default('default');
            $table->string('target_host');
            $table->unsignedSmallInteger('target_port');
            $table->unsignedInteger('weight')->default(1);
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('enabled')->default(true)->index();
            $table->string('health_status')->default('unknown')->index();
            $table->unsignedInteger('consecutive_successes')->default(0);
            $table->unsignedInteger('consecutive_failures')->default(0);
            $table->unsignedInteger('last_latency_ms')->nullable();
            $table->timestampTz('last_checked_at')->nullable();
            $table->text('last_error')->nullable();
            $table->json('health_check')->nullable();
            $table->timestampsTz();
            $table->index(['tunnel_id', 'enabled', 'priority', 'health_status'], 'tunnel_targets_route_idx');
        });

        Schema::create('infrastructure_nodes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('node_type', 30)->index();
            $table->string('name');
            $table->string('region')->default('default')->index();
            $table->string('public_url')->nullable();
            $table->string('internal_url')->nullable();
            $table->string('transport', 30)->default('tcp');
            $table->string('status', 30)->default('healthy')->index();
            $table->unsignedInteger('capacity')->default(1000);
            $table->unsignedInteger('active_connections')->default(0);
            $table->json('metadata')->nullable();
            $table->timestampTz('last_seen_at')->nullable()->index();
            $table->timestampsTz();
            $table->unique(['node_type', 'name']);
        });

        Schema::create('agent_presence', function (Blueprint $table): void {
            $table->foreignUuid('agent_id')->primary()->constrained('agents')->cascadeOnDelete();
            $table->foreignUuid('relay_node_id')->nullable()->constrained('infrastructure_nodes')->nullOnDelete();
            $table->string('relay_edge_url')->nullable();
            $table->timestampTz('connected_at')->nullable();
            $table->timestampTz('last_seen_at')->nullable()->index();
            $table->timestampsTz();
        });

        Schema::create('agent_auth_nonces', function (Blueprint $table): void {
            $table->uuid('agent_id');
            $table->string('nonce', 160);
            $table->timestampTz('expires_at')->index();
            $table->primary(['agent_id', 'nonce']);
            $table->foreign('agent_id')->references('id')->on('agents')->cascadeOnDelete();
        });

        Schema::create('request_inspections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignUuid('tunnel_id')->constrained('tunnels')->cascadeOnDelete();
            $table->foreignUuid('target_id')->nullable()->constrained('tunnel_targets')->nullOnDelete();
            $table->string('method', 16);
            $table->text('path');
            $table->string('hostname')->nullable();
            $table->ipAddress('source_ip')->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->json('request_headers')->nullable();
            $table->longText('request_body')->nullable();
            $table->boolean('request_body_truncated')->default(false);
            $table->json('response_headers')->nullable();
            $table->longText('response_body')->nullable();
            $table->boolean('response_body_truncated')->default(false);
            $table->json('metadata')->nullable();
            $table->timestampTz('created_at')->useCurrent()->index();
            $table->index(['organization_id', 'created_at']);
            $table->index(['tunnel_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_inspections');
        Schema::dropIfExists('agent_auth_nonces');
        Schema::dropIfExists('agent_presence');
        Schema::dropIfExists('infrastructure_nodes');
        Schema::dropIfExists('tunnel_targets');

        Schema::table('tunnels', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('policy_id');
            $table->dropColumn(['inspector_enabled', 'inspector_body_limit', 'health_status']);
        });

        Schema::dropIfExists('policies');
        Schema::dropIfExists('provisioning_tokens');

        Schema::table('agents', function (Blueprint $table): void {
            $table->dropColumn(['session_token_hash', 'session_expires_at', 'region']);
        });
    }
};
