//! Transporte QUIC nativo do Tunnara.
//!
//! Este crate implementa endpoints cliente/servidor com TLS 1.3, streams
//! bidirecionais multiplexados e datagramas QUIC. Ele é independente do
//! runtime Node e serve como camada nativa para a migração do data plane.

use anyhow::{Context, Result};
use quinn::{ClientConfig, Connection, Endpoint, ServerConfig};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use std::{net::SocketAddr, sync::Arc, time::Duration};

pub const ALPN_TUNNARA_V1: &[u8] = b"tunnara/1";

#[derive(Debug, Clone)]
pub struct QuicTransportConfig {
    pub idle_timeout: Duration,
    pub keep_alive_interval: Duration,
    pub max_concurrent_bidi_streams: u32,
    pub max_concurrent_uni_streams: u32,
    pub datagram_receive_buffer_size: usize,
}

impl Default for QuicTransportConfig {
    fn default() -> Self {
        Self {
            idle_timeout: Duration::from_secs(45),
            keep_alive_interval: Duration::from_secs(15),
            max_concurrent_bidi_streams: 4096,
            max_concurrent_uni_streams: 128,
            datagram_receive_buffer_size: 16 * 1024 * 1024,
        }
    }
}

fn transport_config(config: &QuicTransportConfig) -> Result<quinn::TransportConfig> {
    let mut transport = quinn::TransportConfig::default();
    transport
        .max_idle_timeout(Some(
            config
                .idle_timeout
                .try_into()
                .context("idle timeout inválido")?,
        ))
        .keep_alive_interval(Some(config.keep_alive_interval))
        .max_concurrent_bidi_streams(config.max_concurrent_bidi_streams.into())
        .max_concurrent_uni_streams(config.max_concurrent_uni_streams.into())
        .datagram_receive_buffer_size(Some(config.datagram_receive_buffer_size));
    Ok(transport)
}

pub fn make_server_config(
    certificate_chain: Vec<CertificateDer<'static>>,
    private_key: PrivateKeyDer<'static>,
    config: &QuicTransportConfig,
) -> Result<ServerConfig> {
    let mut server = ServerConfig::with_single_cert(certificate_chain, private_key)
        .context("não foi possível criar a configuração TLS do servidor QUIC")?;
    server.transport_config(Arc::new(transport_config(config)?));
    Ok(server)
}

pub fn make_client_config(
    trusted_roots: rustls::RootCertStore,
    config: &QuicTransportConfig,
) -> Result<ClientConfig> {
    let mut client = ClientConfig::with_root_certificates(Arc::new(trusted_roots))
        .context("não foi possível criar a configuração TLS do cliente QUIC")?;
    client.transport_config(Arc::new(transport_config(config)?));
    Ok(client)
}

pub struct QuicServer {
    endpoint: Endpoint,
}

impl QuicServer {
    pub fn bind(address: SocketAddr, server_config: ServerConfig) -> Result<Self> {
        Ok(Self {
            endpoint: Endpoint::server(server_config, address)?,
        })
    }

    pub fn local_addr(&self) -> Result<SocketAddr> {
        Ok(self.endpoint.local_addr()?)
    }

    pub async fn accept(&self) -> Result<Connection> {
        let incoming = self
            .endpoint
            .accept()
            .await
            .context("endpoint QUIC encerrado")?;
        incoming.await.context("handshake QUIC recusado")
    }

    pub fn close(&self, code: u32, reason: &[u8]) {
        self.endpoint.close(quinn::VarInt::from_u32(code), reason);
    }
}

pub struct QuicClient {
    endpoint: Endpoint,
}

impl QuicClient {
    pub fn bind(address: SocketAddr, client_config: ClientConfig) -> Result<Self> {
        let mut endpoint = Endpoint::client(address)?;
        endpoint.set_default_client_config(client_config);
        Ok(Self { endpoint })
    }

    pub async fn connect(&self, remote: SocketAddr, server_name: &str) -> Result<Connection> {
        self.endpoint
            .connect(remote, server_name)
            .context("endereço ou SNI QUIC inválido")?
            .await
            .context("não foi possível estabelecer a conexão QUIC")
    }

    pub fn close(&self, code: u32, reason: &[u8]) {
        self.endpoint.close(quinn::VarInt::from_u32(code), reason);
    }
}

pub async fn send_request(connection: &Connection, payload: &[u8]) -> Result<Vec<u8>> {
    let (mut send, mut recv) = connection
        .open_bi()
        .await
        .context("não foi possível abrir stream QUIC")?;
    send.write_all(payload).await?;
    send.finish()?;
    Ok(recv.read_to_end(64 * 1024 * 1024).await?)
}
