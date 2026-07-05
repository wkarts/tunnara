use anyhow::Result;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::main]
async fn main() -> Result<()> {
    tunnara_config::init_tracing("relay");

    let addr = tunnara_config::env_socket("TUNNARA_RELAY_BIND", "0.0.0.0:7300")?;
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!(%addr, "relay transport listener ready");

    loop {
        let (mut stream, peer) = listener.accept().await?;

        let _connection_task = tokio::spawn(async move {
            let mut preface = [0_u8; 8];

            if stream.read_exact(&mut preface).await.is_ok() && &preface == b"TUNNARA1" {
                let _ = stream.write_all(b"OK\n").await;
                tracing::info!(%peer, "relay handshake accepted");
            } else {
                tracing::warn!(%peer, "invalid relay handshake");
            }
        });
    }
}
