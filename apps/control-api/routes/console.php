<?php

use App\Models\Organization;
use App\Models\ServiceToken;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

Artisan::command(
    'tunnara:bootstrap {organization : Nome da organização} {--slug=} {--token-name=Console} {--token=}',
    function (): int {
        $name = trim((string) $this->argument('organization'));
        $slug = trim((string) ($this->option('slug') ?: Str::slug($name)));

        if ($name === '' || $slug === '') {
            $this->error('Nome e slug da organização são obrigatórios.');

            return 1;
        }

        $organization = Organization::query()->firstOrCreate(
            ['slug' => $slug],
            ['name' => $name, 'status' => 'active']
        );

        $plainToken = trim((string) $this->option('token')) ?: 'tnr_admin_'.Str::random(64);

        ServiceToken::query()->create([
            'organization_id' => $organization->id,
            'name' => (string) $this->option('token-name'),
            'token_hash' => hash('sha256', $plainToken),
            'abilities' => ['*'],
        ]);

        $this->info("Organização pronta: {$organization->name} ({$organization->id})");
        $this->warn('Copie o token agora. Ele não será exibido novamente:');
        $this->line($plainToken);

        return 0;
    }
)->purpose('Cria a primeira organização e um token de serviço do Tunnara.');
