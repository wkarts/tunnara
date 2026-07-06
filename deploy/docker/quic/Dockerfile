FROM rust:1.85-bookworm AS builder
WORKDIR /src
COPY Cargo.toml rust-toolchain.toml ./
COPY crates ./crates
COPY services ./services
RUN cargo build --release -p tunnara-quic-bridge

FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /src/target/release/tunnara-quic-bridge /usr/local/bin/tunnara-quic-bridge
COPY deploy/docker/quic/entrypoint.sh /usr/local/bin/quic-entrypoint
RUN chmod 0755 /usr/local/bin/quic-entrypoint
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/quic-entrypoint"]
