use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::StreamExt;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use tunnara_protocol::{ControlEnvelope, ControlMessage};
use tunnara_types::{AgentRegistration, RegisteredAgent};
use uuid::Uuid;

#[derive(Clone, Default)]
struct AppState {
    agents: Arc<RwLock<HashMap<Uuid, AgentRegistration>>>,
}

#[tokio::main]
async fn main() {
    tunnara_config::init_tracing("coordinator");

    let addr = tunnara_config::env_socket("TUNNARA_COORDINATOR_BIND", "0.0.0.0:7100")
        .expect("endereço de bind inválido");
    let state = AppState::default();

    let app = Router::new()
        .route(
            "/healthz",
            get(|| async {
                Json(serde_json::json!({
                    "status": "ok",
                    "service": "coordinator",
                    "version": env!("CARGO_PKG_VERSION")
                }))
            }),
        )
        .route("/readyz", get(|| async { StatusCode::NO_CONTENT }))
        .route("/v1/agents/register", post(register))
        .route("/v1/control/ws", get(ws))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("não foi possível abrir o listener");

    tracing::info!(%addr, "coordinator listening");
    axum::serve(listener, app)
        .await
        .expect("falha no servidor coordinator");
}

async fn register(
    State(state): State<AppState>,
    Json(payload): Json<AgentRegistration>,
) -> impl IntoResponse {
    let id = Uuid::new_v4();
    state.agents.write().await.insert(id, payload);

    (
        StatusCode::CREATED,
        Json(RegisteredAgent {
            id,
            session_token: Uuid::new_v4().to_string(),
            heartbeat_interval_seconds: 20,
        }),
    )
}

async fn ws(upgrade: WebSocketUpgrade) -> impl IntoResponse {
    upgrade.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    while let Some(Ok(message)) = socket.next().await {
        match message {
            Message::Text(text) => {
                let response = serde_json::from_str::<ControlEnvelope>(&text).map(|envelope| {
                    ControlEnvelope {
                        correlation_id: Some(envelope.id),
                        ..ControlEnvelope::new(ControlMessage::Ack {
                            message_id: envelope.id,
                        })
                    }
                });

                let payload = response
                    .and_then(|value| serde_json::to_string(&value))
                    .unwrap_or_else(|error| {
                        serde_json::json!({ "error": error.to_string() }).to_string()
                    });

                if socket.send(Message::Text(payload.into())).await.is_err() {
                    break;
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}
