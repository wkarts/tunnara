use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use std::{
    fs::File,
    io::BufReader,
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::{
    io,
    io::AsyncWriteExt,
    net::{TcpListener, TcpStream},
    task::JoinSet,
};
use tracing::{error, info, warn};
use tunnara_quic::{
    make_client_config, make_server_config, QuicClient, QuicServer, QuicTransportConfig,
};

#[derive(Debug, Parser)]
#[command(
    name = "tunnara-quic-bridge",
    version,
    about = "Transporta o protocolo Tunnara sobre QUIC/TLS 1.3."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Aceita conexões QUIC e encaminha cada stream para o Relay TCP interno.
    Server {
        #[arg(long, env = "TUNNARA_QUIC_LISTEN", default_value = "0.0.0.0:7443")]
        listen: SocketAddr,
        #[arg(long, env = "TUNNARA_QUIC_UPSTREAM", default_value = "127.0.0.1:7300")]
        upstream: SocketAddr,
        #[arg(long, env = "TUNNARA_QUIC_CERT")]
        cert: PathBuf,
        #[arg(long, env = "TUNNARA_QUIC_KEY")]
        key: PathBuf,
    },
    /// Abre um listener TCP local e transporta conexões ao servidor QUIC remoto.
    Client {
        #[arg(
            long,
            env = "TUNNARA_QUIC_LOCAL_LISTEN",
            default_value = "127.0.0.1:17300"
        )]
        listen: SocketAddr,
        #[arg(long, env = "TUNNARA_QUIC_REMOTE")]
        remote: SocketAddr,
        #[arg(long, env = "TUNNARA_QUIC_SERVER_NAME")]
        server_name: String,
        #[arg(long, env = "TUNNARA_QUIC_CA")]
        ca: Option<PathBuf>,
        #[arg(long, env = "TUNNARA_QUIC_RECONNECT_SECONDS", default_value_t = 3)]
        reconnect_seconds: u64,
    },
}

fn load_certificates(path: &Path) -> Result<Vec<CertificateDer<'static>>> {
    let file = File::open(path)
        .with_context(|| format!("não foi possível abrir o certificado {}", path.display()))?;
    let mut reader = BufReader::new(file);
    let certs = rustls_pemfile::certs(&mut reader)
        .collect::<std::result::Result<Vec<_>, _>>()
        .context("certificado PEM inválido")?;
    if certs.is_empty() {
        bail!("nenhum certificado foi encontrado em {}", path.display());
    }
    Ok(certs)
}

fn load_private_key(path: &Path) -> Result<PrivateKeyDer<'static>> {
    let file = File::open(path)
        .with_context(|| format!("não foi possível abrir a chave {}", path.display()))?;
    let mut reader = BufReader::new(file);
    rustls_pemfile::private_key(&mut reader)
        .context("chave privada PEM inválida")?
        .with_context(|| format!("nenhuma chave privada foi encontrada em {}", path.display()))
}

async fn proxy_quic_to_tcp(
    mut quic_send: quinn::SendStream,
    mut quic_recv: quinn::RecvStream,
    upstream: SocketAddr,
) -> Result<()> {
    let socket = TcpStream::connect(upstream)
        .await
        .with_context(|| format!("não foi possível conectar ao upstream {upstream}"))?;
    socket.set_nodelay(true)?;
    let (mut tcp_read, mut tcp_write) = socket.into_split();

    let quic_to_tcp = async {
        io::copy(&mut quic_recv, &mut tcp_write).await?;
        tcp_write.shutdown().await?;
        Result::<()>::Ok(())
    };
    let tcp_to_quic = async {
        io::copy(&mut tcp_read, &mut quic_send).await?;
        quic_send
            .finish()
            .context("falha ao finalizar stream QUIC")?;
        Result::<()>::Ok(())
    };
    tokio::try_join!(quic_to_tcp, tcp_to_quic)?;
    Ok(())
}

async fn serve_connection(connection: quinn::Connection, upstream: SocketAddr) {
    info!(remote = %connection.remote_address(), "conexão QUIC autenticada");
    let mut tasks = JoinSet::new();
    loop {
        tokio::select! {
            accepted = connection.accept_bi() => match accepted {
                Ok((send, recv)) => {
                    tasks.spawn(async move { proxy_quic_to_tcp(send, recv, upstream).await });
                }
                Err(error) => {
                    info!(%error, "conexão QUIC encerrada");
                    break;
                }
            },
            completed = tasks.join_next(), if !tasks.is_empty() => {
                if let Some(Err(error)) = completed { warn!(%error, "task de stream QUIC terminou com panic/cancelamento"); }
            }
        }
    }
    while let Some(result) = tasks.join_next().await {
        if let Ok(Err(error)) = result {
            warn!(%error, "stream QUIC encerrado com falha");
        }
    }
}

async fn run_server(
    listen: SocketAddr,
    upstream: SocketAddr,
    cert: PathBuf,
    key: PathBuf,
) -> Result<()> {
    let config = QuicTransportConfig::default();
    let server = Arc::new(QuicServer::bind(
        listen,
        make_server_config(load_certificates(&cert)?, load_private_key(&key)?, &config)?,
    )?);
    info!(listen = %server.local_addr()?, %upstream, "Tunnara QUIC Bridge Server iniciado");
    loop {
        match server.accept().await {
            Ok(connection) => tokio::spawn(serve_connection(connection, upstream)),
            Err(error) => warn!(%error, "handshake QUIC recusado"),
        };
    }
}

async fn proxy_tcp_to_quic(local: TcpStream, connection: quinn::Connection) -> Result<()> {
    local.set_nodelay(true)?;
    let (mut quic_send, mut quic_recv) = connection
        .open_bi()
        .await
        .context("não foi possível abrir stream QUIC")?;
    let (mut tcp_read, mut tcp_write) = local.into_split();

    let tcp_to_quic = async {
        io::copy(&mut tcp_read, &mut quic_send).await?;
        quic_send
            .finish()
            .context("falha ao finalizar stream QUIC")?;
        Result::<()>::Ok(())
    };
    let quic_to_tcp = async {
        io::copy(&mut quic_recv, &mut tcp_write).await?;
        tcp_write.shutdown().await?;
        Result::<()>::Ok(())
    };
    tokio::try_join!(tcp_to_quic, quic_to_tcp)?;
    Ok(())
}

async fn connect_quic(
    remote: SocketAddr,
    server_name: &str,
    ca: Option<&Path>,
) -> Result<(QuicClient, quinn::Connection)> {
    let mut roots = rustls::RootCertStore::empty();
    if let Some(ca) = ca {
        let (added, ignored) = roots.add_parsable_certificates(load_certificates(ca)?);
        if added == 0 {
            bail!("nenhum certificado CA válido foi carregado; ignorados: {ignored}");
        }
    } else {
        let native = rustls_native_certs::load_native_certs();
        let (added, ignored) = roots.add_parsable_certificates(native.certs);
        if added == 0 {
            bail!("nenhuma CA do sistema foi carregada; certificados ignorados: {ignored}; erros: {:?}", native.errors);
        }
    }
    let client = QuicClient::bind(
        SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), 0),
        make_client_config(roots, &QuicTransportConfig::default())?,
    )?;
    let connection = client.connect(remote, server_name).await?;
    Ok((client, connection))
}

async fn run_client(
    listen: SocketAddr,
    remote: SocketAddr,
    server_name: String,
    ca: Option<PathBuf>,
    reconnect_seconds: u64,
) -> Result<()> {
    let listener = TcpListener::bind(listen)
        .await
        .with_context(|| format!("não foi possível abrir {listen}"))?;
    info!(%listen, %remote, server_name, "Tunnara QUIC Bridge Client iniciado");

    let mut current: Option<(QuicClient, quinn::Connection)> = None;
    loop {
        if current
            .as_ref()
            .map_or(true, |(_, connection)| connection.close_reason().is_some())
        {
            loop {
                match connect_quic(remote, &server_name, ca.as_deref()).await {
                    Ok(value) => {
                        current = Some(value);
                        info!(%remote, "canal QUIC conectado");
                        break;
                    }
                    Err(error) => {
                        warn!(%error, retry_seconds = reconnect_seconds, "falha ao conectar QUIC");
                        tokio::time::sleep(Duration::from_secs(reconnect_seconds.max(1))).await;
                    }
                }
            }
        }

        let (socket, peer) = listener.accept().await?;
        let connection = current
            .as_ref()
            .expect("conexão QUIC inicializada")
            .1
            .clone();
        tokio::spawn(async move {
            if let Err(error) = proxy_tcp_to_quic(socket, connection).await {
                warn!(%peer, %error, "stream local/QUIC encerrado com falha");
            }
        });
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_target(false)
        .init();
    match Cli::parse().command {
        Command::Server {
            listen,
            upstream,
            cert,
            key,
        } => run_server(listen, upstream, cert, key).await,
        Command::Client {
            listen,
            remote,
            server_name,
            ca,
            reconnect_seconds,
        } => run_client(listen, remote, server_name, ca, reconnect_seconds).await,
    }
    .map_err(|error| {
        error!(%error, "Tunnara QUIC Bridge encerrado");
        error
    })
}
