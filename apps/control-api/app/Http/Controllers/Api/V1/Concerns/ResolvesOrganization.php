<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

trait ResolvesOrganization
{
    private function organizationId(Request $request): string
    {
        $token = $request->attributes->get('service_token');

        abort_unless(
            $token && is_string($token->organization_id) && $token->organization_id !== '',
            Response::HTTP_FORBIDDEN,
            'Token sem organização associada.'
        );

        return $token->organization_id;
    }

    private function authorizeOrganization(Request $request, string $resourceOrganizationId): void
    {
        abort_unless(
            hash_equals($this->organizationId($request), $resourceOrganizationId),
            Response::HTTP_NOT_FOUND,
            'Recurso não encontrado.'
        );
    }
}
