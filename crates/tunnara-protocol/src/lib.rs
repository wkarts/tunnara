use serde::{Deserialize, Serialize};
use uuid::Uuid;
use tunnara_types::TunnelDefinition;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum ControlMessage {
    Hello {
        agent_id: Uuid,
        version: String,
    },
    Heartbeat {
        agent_id: Uuid,
        sequence: u64,
    },
    ConfigureTunnel(TunnelDefinition),
    CloseTunnel {
        tunnel_id: Uuid,
        reason: String,
    },
    Ack {
        message_id: Uuid,
    },
    Error {
        code: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControlEnvelope {
    pub id: Uuid,
    pub correlation_id: Option<Uuid>,
    pub message: ControlMessage,
}

impl ControlEnvelope {
    pub fn new(message: ControlMessage) -> Self {
        Self {
            id: Uuid::new_v4(),
            correlation_id: None,
            message,
        }
    }
}
