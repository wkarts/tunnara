use rustls::pki_types::{PrivateKeyDer, PrivatePkcs8KeyDer};
use std::{net::{IpAddr, Ipv4Addr, SocketAddr}, sync::Arc};
use tunnara_quic::{make_client_config, make_server_config, QuicClient, QuicServer, QuicTransportConfig};

#[tokio::test]
async fn bidirectional_stream_roundtrip() -> anyhow::Result<()> {
    let certified = rcgen::generate_simple_self_signed(vec!["localhost".to_string()])?;
    let certificate = certified.cert.der().clone();
    let private_key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(certified.signing_key.serialize_der()));
    let config = QuicTransportConfig::default();
    let server = Arc::new(QuicServer::bind(
        SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0),
        make_server_config(vec![certificate.clone()], private_key, &config)?,
    )?);
    let server_addr = server.local_addr()?;
    let task_server = server.clone();
    let task = tokio::spawn(async move {
        let connection = task_server.accept().await?;
        let (mut send, mut recv) = connection.accept_bi().await?;
        let data = recv.read_to_end(1024).await?;
        send.write_all(&data).await?;
        send.finish()?;
        anyhow::Ok(())
    });

    let mut roots = rustls::RootCertStore::empty();
    roots.add(certificate)?;
    let client = QuicClient::bind(
        SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 0),
        make_client_config(roots, &config)?,
    )?;
    let connection = client.connect(server_addr, "localhost").await?;
    let (mut send, mut recv) = connection.open_bi().await?;
    send.write_all(b"tunnara-quic").await?;
    send.finish()?;
    assert_eq!(recv.read_to_end(1024).await?, b"tunnara-quic");
    task.await??;
    Ok(())
}
