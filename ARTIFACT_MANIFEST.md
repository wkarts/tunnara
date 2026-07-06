# Manifesto de artefatos — Tunnara Platform 2.0.0-rc.3

## Pacotes centrais

- `Tunnara-Platform-v2.0.0-rc.3-GitHub-Ready.zip`
- `Tunnara-Platform-v2.0.0-rc.3-Pacote-Completo.zip`
- `Tunnara-Platform-v2.0.0-rc.3-Codigo-Fonte.zip`
- `Tunnara-Platform-v2.0.0-rc.3-Codigo-Fonte.tar.gz`
- `Tunnara-Platform-v2.0.0-rc.3-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.3-PR-Git-Repository.bundle`
- `Tunnara-Platform-v2.0.0-rc.3.patch`
- `Tunnara-Platform-v2.0.0-rc.3-Arquivos-Alterados.zip`

## Distribuição

- `Tunnara-Console-Web-v2.0.0-rc.3.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.3.zip`
- `Tunnara-Runtime-Linux-x64-v2.0.0-rc.3.tar.gz`
- `Tunnara-SDK-C-Linux-x64-v2.0.0-rc.3.zip`
- `Tunnara-Docker-v2.0.0-rc.3.zip`
- `Tunnara-Helm-v2.0.0-rc.3.zip`
- `Tunnara-Platform-v2.0.0-rc.3-SHA256SUMS.txt`

## Correção central

O empacotador SEA utiliza a API JavaScript oficial do `esbuild`. O binário nativo `node_modules/esbuild/bin/esbuild` não é mais passado ao interpretador Node.js.

## Conteúdo do pacote completo

- código-fonte sem caches, bancos, segredos ou dependências reconstruíveis;
- Console Web compilado;
- Agent e Server standalone Linux x64;
- SDK C dinâmico e estático Linux x64;
- Docker single-node, produção, distribuído e observabilidade;
- Helm Chart;
- Control API Laravel, runtime, serviços Rust e projetos mobile;
- documentação, OpenAPI, testes, workflows e scripts de release.

## Política

Pull Requests não enviam artefatos ao GitHub Actions. O preflight SEA compila somente em memória. A release permanece em draft até a conclusão dos workflows obrigatórios.
