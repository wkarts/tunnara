use axum::{http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    tunnara_config::init_tracing("edge");

    let addr = tunnara_config::env_socket("TUNNARA_EDGE_BIND", "0.0.0.0:7200")
        .expect("endereço de bind inválido");

    let app = Router::new()
        .route(
            "/healthz",
            get(|| async {
                Json(serde_json::json!({
                    "status": "ok",
                    "service": "edge",
                    "version": env!("CARGO_PKG_VERSION")
                }))
            }),
        )
        .fallback(|| async {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Nenhuma rota de túnel foi associada a este host.",
            )
                .into_response()
        })
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("não foi possível abrir o listener");

    tracing::info!(%addr, "edge listening");
    axum::serve(listener, app)
        .await
        .expect("falha no servidor edge");
}
