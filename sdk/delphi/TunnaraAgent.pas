unit TunnaraAgent;

interface

uses
  System.SysUtils;

type
  ETunnaraError = class(Exception);

  TTunnaraAgent = class
  private
    FLibraryHandle: NativeUInt;
    FClient: Pointer;
    FHost: UTF8String;
    FToken: UTF8String;
    FPort: Word;
    function ResolveSymbol(const AName: AnsiString): Pointer;
    function ExecuteJson(const AFunctionName: AnsiString): string;
    procedure CheckResult(const AResult: Integer; const AJson: PAnsiChar = nil);
  public
    constructor Create(const ALibraryPath, ALocalApiToken: string;
      const AHost: string = '127.0.0.1'; const APort: Word = 7390);
    destructor Destroy; override;

    class function DefaultLibraryName: string; static;
    function Version: string;
    function LastError: string;
    function Status: string;
    function ListTunnels: string;
    function CreateHttpTunnel(const ALocalPort: Word;
      const AHostname: string = ''; const AAutoDns: Boolean = True): string;
    function CreateTcpTunnel(const ALocalPort: Word;
      const APublicPort: Word = 0): string;
    function CreateUdpTunnel(const ALocalPort: Word;
      const APublicPort: Word = 0): string;
    procedure DeleteTunnel(const ATunnelId: string);
    function ListNetworks: string;
    function JoinNetwork(const ANetworkId: string;
      const AActivate: Boolean = True): string;
    function LeaveNetwork(const ANetworkId: string): string;
  end;

implementation

{$IFDEF MSWINDOWS}
uses
  Winapi.Windows;
{$ELSE}
uses
  Posix.Dlfcn;
{$ENDIF}

type
  TTunnaraVersionFn = function: PAnsiChar; cdecl;
  TTunnaraClientCreateFn = function(AHost: PAnsiChar; APort: Word;
    AToken: PAnsiChar): Pointer; cdecl;
  TTunnaraClientDestroyFn = procedure(AClient: Pointer); cdecl;
  TTunnaraLastErrorFn = function(AClient: Pointer): PAnsiChar; cdecl;
  TTunnaraStringFreeFn = procedure(AValue: PAnsiChar); cdecl;
  TTunnaraJsonFn = function(AClient: Pointer; out AJson: PAnsiChar): Integer; cdecl;
  TTunnaraCreateHttpFn = function(AClient: Pointer; ALocalPort: Word;
    AHostname: PAnsiChar; AAutoDns: Integer; out AJson: PAnsiChar): Integer; cdecl;
  TTunnaraCreatePortFn = function(AClient: Pointer; ALocalPort,
    APublicPort: Word; out AJson: PAnsiChar): Integer; cdecl;
  TTunnaraDeleteTunnelFn = function(AClient: Pointer;
    ATunnelId: PAnsiChar): Integer; cdecl;
  TTunnaraNetworkActionFn = function(AClient: Pointer; ANetworkId: PAnsiChar;
    AActivate: Integer; out AJson: PAnsiChar): Integer; cdecl;
  TTunnaraNetworkLeaveFn = function(AClient: Pointer; ANetworkId: PAnsiChar;
    out AJson: PAnsiChar): Integer; cdecl;

class function TTunnaraAgent.DefaultLibraryName: string;
begin
{$IFDEF MSWINDOWS}
  Result := 'tunnara.dll';
{$ELSEIF Defined(MACOS)}
  Result := 'libtunnara.dylib';
{$ELSE}
  Result := 'libtunnara.so';
{$ENDIF}
end;

constructor TTunnaraAgent.Create(const ALibraryPath, ALocalApiToken,
  AHost: string; const APort: Word);
var
  LCreate: TTunnaraClientCreateFn;
  LPath: string;
{$IFNDEF MSWINDOWS}
  LPathUtf8: UTF8String;
{$ENDIF}
begin
  inherited Create;
  if Trim(ALocalApiToken) = '' then
    raise EArgumentException.Create('O token da API local Tunnara não foi informado.');
  LPath := Trim(ALibraryPath);
  if LPath = '' then
    LPath := DefaultLibraryName;
{$IFDEF MSWINDOWS}
  FLibraryHandle := NativeUInt(LoadLibrary(PChar(LPath)));
{$ELSE}
  LPathUtf8 := UTF8String(LPath);
  FLibraryHandle := NativeUInt(dlopen(PAnsiChar(LPathUtf8), RTLD_NOW));
{$ENDIF}
  if FLibraryHandle = 0 then
    raise ETunnaraError.CreateFmt('Não foi possível carregar a biblioteca Tunnara: %s', [LPath]);
  FHost := UTF8String(AHost);
  FToken := UTF8String(ALocalApiToken);
  FPort := APort;
  Pointer(LCreate) := ResolveSymbol('tunnara_client_create');
  FClient := LCreate(PAnsiChar(FHost), FPort, PAnsiChar(FToken));
  if not Assigned(FClient) then
    raise ETunnaraError.Create('Não foi possível criar o cliente Tunnara.');
end;

function TTunnaraAgent.ResolveSymbol(const AName: AnsiString): Pointer;
begin
{$IFDEF MSWINDOWS}
  Result := GetProcAddress(HMODULE(FLibraryHandle), PAnsiChar(AName));
{$ELSE}
  Result := dlsym(Pointer(FLibraryHandle), PAnsiChar(AName));
{$ENDIF}
  if not Assigned(Result) then
    raise ETunnaraError.CreateFmt('A função %s não foi localizada na biblioteca Tunnara.', [string(AName)]);
end;

destructor TTunnaraAgent.Destroy;
var
  LDestroy: TTunnaraClientDestroyFn;
begin
  if Assigned(FClient) and (FLibraryHandle <> 0) then
  begin
    Pointer(LDestroy) := ResolveSymbol('tunnara_client_destroy');
    LDestroy(FClient);
    FClient := nil;
  end;
  if FLibraryHandle <> 0 then
  begin
{$IFDEF MSWINDOWS}
    FreeLibrary(HMODULE(FLibraryHandle));
{$ELSE}
    dlclose(Pointer(FLibraryHandle));
{$ENDIF}
    FLibraryHandle := 0;
  end;
  inherited Destroy;
end;

function TTunnaraAgent.Version: string;
var
  LFn: TTunnaraVersionFn;
  LValue: PAnsiChar;
begin
  Pointer(LFn) := ResolveSymbol('tunnara_version');
  LValue := LFn();
  if Assigned(LValue) then
    Result := string(UTF8String(LValue))
  else
    Result := '';
end;

function TTunnaraAgent.LastError: string;
var
  LFn: TTunnaraLastErrorFn;
  LValue: PAnsiChar;
begin
  Pointer(LFn) := ResolveSymbol('tunnara_last_error');
  LValue := LFn(FClient);
  if Assigned(LValue) then
    Result := string(UTF8String(LValue))
  else
    Result := '';
end;

procedure TTunnaraAgent.CheckResult(const AResult: Integer;
  const AJson: PAnsiChar);
var
  LMessage: string;
begin
  if AResult = 0 then
    Exit;
  LMessage := LastError;
  if (LMessage = '') and Assigned(AJson) then
    LMessage := string(UTF8String(AJson));
  if LMessage = '' then
    LMessage := Format('Falha Tunnara. Código: %d', [AResult]);
  raise ETunnaraError.Create(LMessage);
end;

function TTunnaraAgent.ExecuteJson(const AFunctionName: AnsiString): string;
var
  LFn: TTunnaraJsonFn;
  LFree: TTunnaraStringFreeFn;
  LJson: PAnsiChar;
  LResult: Integer;
begin
  LJson := nil;
  Pointer(LFn) := ResolveSymbol(AFunctionName);
  Pointer(LFree) := ResolveSymbol('tunnara_string_free');
  LResult := LFn(FClient, LJson);
  try
    CheckResult(LResult, LJson);
    if Assigned(LJson) then
      Result := string(UTF8String(LJson))
    else
      Result := '';
  finally
    if Assigned(LJson) then
      LFree(LJson);
  end;
end;

function TTunnaraAgent.Status: string;
begin
  Result := ExecuteJson('tunnara_status');
end;

function TTunnaraAgent.ListTunnels: string;
begin
  Result := ExecuteJson('tunnara_tunnel_list');
end;

function TTunnaraAgent.CreateHttpTunnel(const ALocalPort: Word;
  const AHostname: string; const AAutoDns: Boolean): string;
var
  LFn: TTunnaraCreateHttpFn;
  LFree: TTunnaraStringFreeFn;
  LHostname: UTF8String;
  LJson: PAnsiChar;
  LResult: Integer;
begin
  LJson := nil;
  LHostname := UTF8String(AHostname);
  Pointer(LFn) := ResolveSymbol('tunnara_tunnel_create_http');
  Pointer(LFree) := ResolveSymbol('tunnara_string_free');
  LResult := LFn(FClient, ALocalPort, PAnsiChar(LHostname), Ord(AAutoDns), LJson);
  try
    CheckResult(LResult, LJson);
    Result := string(UTF8String(LJson));
  finally
    if Assigned(LJson) then LFree(LJson);
  end;
end;

function TTunnaraAgent.CreateTcpTunnel(const ALocalPort,
  APublicPort: Word): string;
var
  LFn: TTunnaraCreatePortFn;
  LFree: TTunnaraStringFreeFn;
  LJson: PAnsiChar;
  LResult: Integer;
begin
  LJson := nil;
  Pointer(LFn) := ResolveSymbol('tunnara_tunnel_create_tcp');
  Pointer(LFree) := ResolveSymbol('tunnara_string_free');
  LResult := LFn(FClient, ALocalPort, APublicPort, LJson);
  try CheckResult(LResult, LJson); Result := string(UTF8String(LJson));
  finally if Assigned(LJson) then LFree(LJson); end;
end;

function TTunnaraAgent.CreateUdpTunnel(const ALocalPort,
  APublicPort: Word): string;
var
  LFn: TTunnaraCreatePortFn;
  LFree: TTunnaraStringFreeFn;
  LJson: PAnsiChar;
  LResult: Integer;
begin
  LJson := nil;
  Pointer(LFn) := ResolveSymbol('tunnara_tunnel_create_udp');
  Pointer(LFree) := ResolveSymbol('tunnara_string_free');
  LResult := LFn(FClient, ALocalPort, APublicPort, LJson);
  try CheckResult(LResult, LJson); Result := string(UTF8String(LJson));
  finally if Assigned(LJson) then LFree(LJson); end;
end;

procedure TTunnaraAgent.DeleteTunnel(const ATunnelId: string);
var
  LFn: TTunnaraDeleteTunnelFn;
  LId: UTF8String;
begin
  LId := UTF8String(ATunnelId);
  Pointer(LFn) := ResolveSymbol('tunnara_tunnel_delete');
  CheckResult(LFn(FClient, PAnsiChar(LId)));
end;

function TTunnaraAgent.ListNetworks: string;
begin
  Result := ExecuteJson('tunnara_network_list');
end;

function TTunnaraAgent.JoinNetwork(const ANetworkId: string;
  const AActivate: Boolean): string;
var
  LFn: TTunnaraNetworkActionFn;
  LFree: TTunnaraStringFreeFn;
  LId: UTF8String;
  LJson: PAnsiChar;
  LResult: Integer;
begin
  LJson := nil;
  LId := UTF8String(ANetworkId);
  Pointer(LFn) := ResolveSymbol('tunnara_network_join');
  Pointer(LFree) := ResolveSymbol('tunnara_string_free');
  LResult := LFn(FClient, PAnsiChar(LId), Ord(AActivate), LJson);
  try CheckResult(LResult, LJson); Result := string(UTF8String(LJson));
  finally if Assigned(LJson) then LFree(LJson); end;
end;

function TTunnaraAgent.LeaveNetwork(const ANetworkId: string): string;
var
  LFn: TTunnaraNetworkLeaveFn;
  LFree: TTunnaraStringFreeFn;
  LId: UTF8String;
  LJson: PAnsiChar;
  LResult: Integer;
begin
  LJson := nil;
  LId := UTF8String(ANetworkId);
  Pointer(LFn) := ResolveSymbol('tunnara_network_leave');
  Pointer(LFree) := ResolveSymbol('tunnara_string_free');
  LResult := LFn(FClient, PAnsiChar(LId), LJson);
  try CheckResult(LResult, LJson); Result := string(UTF8String(LJson));
  finally if Assigned(LJson) then LFree(LJson); end;
end;

end.
