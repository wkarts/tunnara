
export interface ControlSession {
  authenticated: boolean;
  organizationId: string;
  organizationName: string;
  tokenId: string;
  scopes: string[];
}
export interface PlatformOverview {
  agentsOnline: number;
  tunnelsActive: number;
  edgeNodesHealthy: number;
  activeConnections: number;
  trafficTodayGb: number;
  alerts: number;
}

export interface TunnaraAgent {
  id: string;
  name: string;
  platform: string;
  architecture: string;
  version: string;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface TunnaraTunnel {
  id: string;
  organizationId: string;
  agentId: string;
  name: string;
  protocol: string;
  hostname: string;
  endpoint: string;
  targetHost: string;
  targetPort: number;
  publicPort: number | null;
  transport: string;
  tlsMode: string;
  dnsRecordId: string | null;
  target: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  policyId?: string | null;
  inspectorEnabled?: boolean;
  inspectorBodyLimit?: number;
  healthStatus?: string;
  targets?: TunnelTarget[];
}

export interface AuditRow {
  id: number;
  actor_type: string;
  actor_id: string | null;
  event: string;
  resource_type: string | null;
  resource_id: string | null;
  result: string;
  metadata_json: string;
  created_at: string;
}

const ENV_API_BASE = String(import.meta.env.VITE_TUNNARA_API_URL || "").replace(/\/$/, "");
const ENV_API_TOKEN = String(import.meta.env.VITE_TUNNARA_API_TOKEN || "");
const BASE_KEY = "tunnara.controlApiBase";
const TOKEN_KEY = "tunnara.controlApiToken";

function storageGet(key: string, sessionOnly = false): string {
  try { return (sessionOnly ? window.sessionStorage : window.localStorage).getItem(key) || ""; } catch { return ""; }
}

function storageSet(key: string, value: string, sessionOnly = false) {
  try {
    const storage = sessionOnly ? window.sessionStorage : window.localStorage;
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {}
}

export function getControlBaseUrl(): string {
  return (storageGet(BASE_KEY) || ENV_API_BASE || "/control").replace(/\/$/, "");
}

export function setControlBaseUrl(value: string) {
  storageSet(BASE_KEY, String(value || "").trim().replace(/\/$/, ""));
}

export function getControlToken(): string {
  return storageGet(TOKEN_KEY, true) || ENV_API_TOKEN;
}

export function setControlToken(value: string) {
  storageSet(TOKEN_KEY, String(value || "").trim(), true);
}

async function apiRequest<T>(path: string, options: RequestInit = {}, requireToken = true): Promise<T> {
  const token = getControlToken();
  if (requireToken && !token) throw new Error("Informe o token administrativo do Control API.");
  const response = await fetch(`${getControlBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "message" in payload
      ? String((payload as { message?: unknown }).message || `HTTP ${response.status}`)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function testControlConnection(): Promise<{ status: string; service: string; version: string }> {
  return apiRequest("/healthz", {}, false);
}

export async function getControlSession(): Promise<ControlSession> {
  return apiRequest("/api/v1/session");
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  return apiRequest("/api/v1/overview");
}

export async function listAgents(): Promise<TunnaraAgent[]> {
  const response = await apiRequest<{ data: TunnaraAgent[] }>("/api/v1/agents");
  return response.data;
}


export async function revokeAgent(id: string): Promise<void> {
  await apiRequest(`/api/v1/agents/${encodeURIComponent(id)}/revoke`, { method: "POST" });
}

export async function createProvisioningToken(name: string, ttlSeconds = 900): Promise<{ token: string; expiresAt: string }> {
  return apiRequest("/api/v1/provisioning-tokens", {
    method: "POST",
    body: JSON.stringify({ name, ttlSeconds }),
  });
}

export async function listTunnels(): Promise<TunnaraTunnel[]> {
  const response = await apiRequest<{ data: TunnaraTunnel[] }>("/api/v1/tunnels");
  return response.data;
}

export async function createTunnel(input: {
  agentId: string;
  name: string;
  protocol?: "http" | "https" | "tcp" | "udp";
  hostname?: string;
  publicPort?: number;
  targetHost?: string;
  targetPort: number;
  autoDns?: boolean;
  transport?: "auto" | "tcp" | "quic";
  policyId?: string | null;
  inspectorEnabled?: boolean;
  inspectorBodyLimit?: number;
  targets?: Array<{ agentId: string; name: string; targetHost: string; targetPort: number; weight?: number; priority?: number; enabled?: boolean; healthCheck?: Record<string, unknown> }>;
}): Promise<TunnaraTunnel> {
  return apiRequest("/api/v1/tunnels", {
    method: "POST",
    body: JSON.stringify({ protocol: "http", targetHost: "127.0.0.1", autoDns: true, transport: "auto", ...input }),
  });
}

export async function deleteTunnel(id: string): Promise<void> {
  await apiRequest(`/api/v1/tunnels/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listAudit(): Promise<AuditRow[]> {
  const response = await apiRequest<{ data: AuditRow[] }>("/api/v1/audit");
  return response.data;
}

export const tunnaraApiBase = ENV_API_BASE;

export interface CloudflareIntegration {
  id: string;
  provider: string;
  name: string;
  config: Record<string, unknown>;
  status: string;
  hasSecret: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
}

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: number | boolean;
  ttl: number;
  status: string;
  created_at: string;
}

export interface InfrastructureNode {
  id: string;
  node_type: string;
  name: string;
  region: string;
  public_url: string | null;
  internal_url: string | null;
  transport: string;
  status: string;
  capacity: number;
  active_connections: number;
  last_seen_at: string;
}

export interface PrivateNetwork {
  id: string;
  name: string;
  cidr: string;
  dns_domain: string | null;
  mode: string;
  status: string;
  created_at: string;
}

export interface NetworkPeer {
  id: string;
  network_id: string;
  agent_id: string;
  virtual_ip: string;
  public_key: string | null;
  endpoint: string | null;
  status: string;
}

export async function getCloudflareIntegration(): Promise<CloudflareIntegration | null> {
  return apiRequest("/api/v1/integrations/cloudflare");
}

export async function configureCloudflare(input: {
  apiToken?: string;
  zoneId?: string;
  zoneName: string;
  managedDomain?: string;
  edgeHostname?: string;
  edgeAddress?: string;
  proxied?: boolean;
  ttl?: number;
  dnsMode?: "wildcard" | "per-tunnel";
  acmeEmail?: string;
  acmeStaging?: boolean;
}): Promise<CloudflareIntegration> {
  return apiRequest("/api/v1/integrations/cloudflare", { method: "PUT", body: JSON.stringify(input) });
}

export async function testCloudflare(): Promise<Record<string, unknown>> {
  return apiRequest("/api/v1/integrations/cloudflare/test", { method: "POST", body: "{}" });
}

export async function bootstrapCloudflareDns(): Promise<Record<string, unknown>> {
  return apiRequest("/api/v1/integrations/cloudflare/bootstrap-dns", { method: "POST", body: "{}" });
}

export async function listDnsRecords(): Promise<DnsRecord[]> {
  const response = await apiRequest<{ data: DnsRecord[] }>("/api/v1/dns/records");
  return response.data;
}

export async function deleteDnsRecord(id: string): Promise<void> {
  await apiRequest(`/api/v1/dns/records/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listNodes(): Promise<InfrastructureNode[]> {
  const response = await apiRequest<{ data: InfrastructureNode[] }>("/api/v1/nodes");
  return response.data;
}

export async function listNetworks(): Promise<PrivateNetwork[]> {
  const response = await apiRequest<{ data: PrivateNetwork[] }>("/api/v1/networks");
  return response.data;
}

export async function createNetwork(input: { name: string; cidr: string; dnsDomain?: string; mode?: "hub-spoke" | "mesh"; hubAgentId?: string }): Promise<PrivateNetwork> {
  return apiRequest("/api/v1/networks", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteNetwork(id: string): Promise<void> {
  await apiRequest(`/api/v1/networks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listNetworkPeers(id: string): Promise<{ network: PrivateNetwork; data: NetworkPeer[] }> {
  return apiRequest(`/api/v1/networks/${encodeURIComponent(id)}/peers`);
}

export interface TrafficPolicy {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  document: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TunnelTarget {
  id: string;
  tunnelId?: string;
  tunnel_id?: string;
  agentId?: string;
  agent_id?: string;
  name: string;
  targetHost?: string;
  target_host?: string;
  targetPort?: number;
  target_port?: number;
  target?: string;
  weight: number;
  priority: number;
  enabled: boolean;
  healthStatus?: string;
  health_status?: string;
  healthCheck?: Record<string, unknown>;
  health_check?: Record<string, unknown>;
  lastCheckedAt?: string | null;
  last_checked_at?: string | null;
  lastError?: string | null;
  last_error?: string | null;
}

export interface RequestInspection {
  id: string;
  tunnel_id: string;
  request_id: string;
  method: string;
  path: string;
  request_headers: Record<string, string>;
  request_body: { encoding?: string; data?: string; truncated?: boolean } | null;
  response_status: number | null;
  response_headers: Record<string, string>;
  response_body: { encoding?: string; data?: string; truncated?: boolean } | null;
  duration_ms: number | null;
  source_ip: string | null;
  created_at: string;
}

export async function listPolicies(): Promise<TrafficPolicy[]> {
  const response = await apiRequest<{ data: TrafficPolicy[] }>("/api/v1/policies");
  return response.data;
}

export async function createPolicy(input: { name: string; description?: string; document: Record<string, unknown>; enabled?: boolean }): Promise<TrafficPolicy> {
  return apiRequest("/api/v1/policies", { method: "POST", body: JSON.stringify(input) });
}

export async function updatePolicy(id: string, input: Partial<{ name: string; description: string; document: Record<string, unknown>; enabled: boolean }>): Promise<TrafficPolicy> {
  return apiRequest(`/api/v1/policies/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function deletePolicy(id: string): Promise<void> {
  await apiRequest(`/api/v1/policies/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listInspections(tunnelId = "", limit = 100): Promise<RequestInspection[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (tunnelId) query.set("tunnelId", tunnelId);
  const response = await apiRequest<{ data: RequestInspection[] }>(`/api/v1/inspections?${query.toString()}`);
  return response.data;
}

export async function getInspection(id: string): Promise<RequestInspection> {
  return apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}`);
}

export async function replayInspection(id: string): Promise<{ status: number; headers: Record<string, string | string[]>; bodyBase64: string; truncated: boolean }> {
  return apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}/replay`, { method: "POST", body: "{}" });
}

export async function deleteInspection(id: string): Promise<void> {
  await apiRequest(`/api/v1/inspections/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function purgeInspections(olderThanDays = 0): Promise<number> {
  const response = await apiRequest<{ deleted: number }>(`/api/v1/inspections?olderThanDays=${olderThanDays}`, { method: "DELETE" });
  return response.deleted;
}

export async function listTunnelTargets(tunnelId: string): Promise<TunnelTarget[]> {
  const response = await apiRequest<{ data: TunnelTarget[] }>(`/api/v1/tunnels/${encodeURIComponent(tunnelId)}/targets`);
  return response.data;
}

export async function createTunnelTarget(tunnelId: string, input: {
  agentId: string; name: string; targetHost: string; targetPort: number; weight?: number; priority?: number; enabled?: boolean; healthCheck?: Record<string, unknown>;
}): Promise<TunnelTarget> {
  return apiRequest(`/api/v1/tunnels/${encodeURIComponent(tunnelId)}/targets`, { method: "POST", body: JSON.stringify(input) });
}

export async function updateTunnelTarget(id: string, input: Record<string, unknown>): Promise<TunnelTarget> {
  return apiRequest(`/api/v1/tunnel-targets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function deleteTunnelTarget(id: string): Promise<void> {
  await apiRequest(`/api/v1/tunnel-targets/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateTunnel(id: string, input: Record<string, unknown>): Promise<TunnaraTunnel> {
  return apiRequest(`/api/v1/tunnels/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}
