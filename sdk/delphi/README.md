# Tunnara SDK Delphi

A unit `TunnaraAgent.pas` encapsula a ABI C estável do Tunnara e controla o Agent instalado como daemon local.

## Bibliotecas

- Windows: `tunnara.dll`
- Linux: `libtunnara.so`
- macOS: `libtunnara.dylib`

## Exemplo

```delphi
uses TunnaraAgent;

var
  Tunnara: TTunnaraAgent;
begin
  Tunnara := TTunnaraAgent.Create(
    TTunnaraAgent.DefaultLibraryName,
    GetEnvironmentVariable('TUNNARA_LOCAL_API_TOKEN')
  );
  try
    Writeln(Tunnara.CreateHttpTunnel(8080, 'erp.exemplo.com', True));
    Writeln(Tunnara.CreateTcpTunnel(3050, 23050));
  finally
    Tunnara.Free;
  end;
end;
```

O token local é criado no provisionamento do Agent e deve permanecer restrito ao usuário/serviço da aplicação.

## Exemplo completo

O arquivo `examples/TunnaraConsoleExample.dpr` demonstra carregamento dinâmico, status, criação HTTP/TCP/UDP e redes privadas. Adicione `sdk/delphi` ao Search Path do projeto.

Assinaturas públicas:

- `Status`;
- `ListTunnels`;
- `CreateHttpTunnel`;
- `CreateTcpTunnel`;
- `CreateUdpTunnel`;
- `DeleteTunnel`;
- `ListNetworks`;
- `JoinNetwork`;
- `LeaveNetwork`.
