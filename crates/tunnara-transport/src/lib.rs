use anyhow::Result;
use async_trait::async_trait;
use tokio::io::{AsyncRead, AsyncWrite};

pub trait IoStream: AsyncRead + AsyncWrite + Unpin + Send {}

impl<T> IoStream for T where T: AsyncRead + AsyncWrite + Unpin + Send {}

#[async_trait]
pub trait Transport: Send + Sync {
    async fn connect(&self, endpoint: &str) -> Result<Box<dyn IoStream>>;

    fn name(&self) -> &'static str;
}

#[derive(Debug, Clone, Copy)]
pub enum TransportKind {
    Quic,
    TlsTcp,
    WebSocket,
    Http2,
}
