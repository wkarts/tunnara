use anyhow::Result;
use clap::{Parser, Subcommand};
use tunnara_types::AgentRegistration;

#[derive(Parser)]
#[command(name = "tunnara", version, about = "Agente multiplataforma Tunnara")]
struct Cli {
    #[arg(
        long,
        env = "TUNNARA_COORDINATOR_URL",
        default_value = "http://127.0.0.1:7100"
    )]
    coordinator: String,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Register {
        #[arg(long)]
        name: String,
        #[arg(long, env = "TUNNARA_AGENT_PUBLIC_KEY")]
        public_key: String,
    },
    Status,
    Serve {
        #[arg(long, default_value_t = 8080)]
        local_port: u16,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tunnara_config::init_tracing("agent");
    let cli = Cli::parse();

    match cli.command {
        Command::Register { name, public_key } => {
            let payload = AgentRegistration {
                name,
                platform: std::env::consts::OS.into(),
                architecture: std::env::consts::ARCH.into(),
                version: env!("CARGO_PKG_VERSION").into(),
                public_key,
            };

            let response = reqwest::Client::new()
                .post(format!(
                    "{}/v1/agents/register",
                    cli.coordinator.trim_end_matches('/')
                ))
                .json(&payload)
                .send()
                .await?
                .error_for_status()?;

            println!("{}", response.text().await?);
        }
        Command::Status => {
            println!(
                "agent version={} coordinator={}",
                env!("CARGO_PKG_VERSION"),
                cli.coordinator
            );
        }
        Command::Serve { local_port } => {
            println!(
                "Modo de serviço preparado para publicar 127.0.0.1:{local_port}. \
                 O runtime funcional da série 0.2 está em runtime/node; este binário Rust permanece experimental."
            );
            tokio::signal::ctrl_c().await?;
        }
    }

    Ok(())
}
