use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TunnelProtocol {
    Http,
    Https,
    Tcp,
    Udp,
    PrivateNetwork,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentStatus {
    Provisioning,
    Online,
    Offline,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRegistration {
    pub name: String,
    pub platform: String,
    pub architecture: String,
    pub version: String,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisteredAgent {
    pub id: Uuid,
    pub session_token: String,
    pub heartbeat_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelDefinition {
    pub id: Uuid,
    pub name: String,
    pub protocol: TunnelProtocol,
    pub target_host: String,
    pub target_port: u16,
    pub public_hostname: Option<String>,
    pub public_port: Option<u16>,
}
