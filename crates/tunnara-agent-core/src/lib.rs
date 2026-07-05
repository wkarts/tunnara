use std::{collections::HashMap, sync::Arc};

use tokio::sync::RwLock;
use tunnara_types::TunnelDefinition;
use uuid::Uuid;

#[derive(Clone, Default)]
pub struct AgentRuntime {
    tunnels: Arc<RwLock<HashMap<Uuid, TunnelDefinition>>>,
}

impl AgentRuntime {
    pub async fn apply(&self, tunnel: TunnelDefinition) {
        self.tunnels.write().await.insert(tunnel.id, tunnel);
    }

    pub async fn remove(&self, id: &Uuid) {
        self.tunnels.write().await.remove(id);
    }

    pub async fn list(&self) -> Vec<TunnelDefinition> {
        self.tunnels.read().await.values().cloned().collect()
    }
}
