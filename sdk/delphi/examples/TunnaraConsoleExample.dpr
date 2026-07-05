program TunnaraConsoleExample;

{$APPTYPE CONSOLE}

uses
  System.SysUtils,
  TunnaraAgent in '..\TunnaraAgent.pas';

var
  Agent: TTunnaraAgent;
  Token: string;
begin
  try
    Token := GetEnvironmentVariable('TUNNARA_LOCAL_API_TOKEN');
    if Token = '' then
      raise Exception.Create('Defina TUNNARA_LOCAL_API_TOKEN.');

    Agent := TTunnaraAgent.Create(
      TTunnaraAgent.DefaultLibraryName,
      '127.0.0.1',
      7390,
      Token
    );
    try
      Writeln('SDK: ', Agent.Version);
      Writeln('Status: ', Agent.Status);
      Writeln('HTTP: ', Agent.CreateHttpTunnel(8080,
        'erp.tunnel.seudominio.com.br', True));
      Writeln('TCP: ', Agent.CreateTcpTunnel(3050, 23050));
      Writeln('UDP: ', Agent.CreateUdpTunnel(51820, 25182));
      Writeln('Redes: ', Agent.ListNetworks);
    finally
      Agent.Free;
    end;
  except
    on E: Exception do
    begin
      Writeln(ErrOutput, E.ClassName, ': ', E.Message);
      ExitCode := 1;
    end;
  end;
end.
