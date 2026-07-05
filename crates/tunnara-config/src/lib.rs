use std::{env, net::SocketAddr};

use anyhow::{Context, Result};

pub fn env_string(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_string())
}

pub fn env_socket(name: &str, default: &str) -> Result<SocketAddr> {
    env_string(name, default)
        .parse()
        .with_context(|| format!("{name} deve ser um SocketAddr válido"))
}

pub fn init_tracing(service: &str) {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,tower_http=info".into());

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .json()
        .with_current_span(true)
        .with_target(true)
        .init();

    tracing::info!(service = service, "logging initialized");
}
