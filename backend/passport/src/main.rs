#![deny(clippy::unwrap_used)]
#![warn(clippy::all, clippy::pedantic, clippy::nursery)]
#![allow(
    clippy::missing_errors_doc,
    clippy::must_use_candidate,
    clippy::missing_panics_doc,
    clippy::wildcard_imports
)]

use crate::{
    api::{oauth, routes},
    config::Config,
    infrastructure::{
        db::postgres::{run_migrations, PostgresClient},
        logging::init_tracing,
    },
};

use axum::{http::StatusCode, routing::get};
use infrastructure::jwt::JWT;
use openapi::ApiDoc;
use sqlx::PgPool;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_cookies::CookieManagerLayer;
use tower_http::{compression::CompressionLayer, cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;

#[cfg(feature = "swagger")]
use utoipa_swagger_ui::SwaggerUi;

pub mod api;
pub mod config;
pub mod domain;
pub mod errors;
pub mod infrastructure;
pub mod openapi;
pub mod utils;

#[derive(Clone)]
pub struct AppState {
    pool: PgPool,
    client: reqwest::Client,
    jwt: Arc<JWT>,
    github_client_id: String,
    github_client_secret: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = Config::from_env()?;

    let pool = PostgresClient::new(&config.database_url).await?;
    run_migrations(&pool).await?;

    let client = reqwest::Client::builder()
        .user_agent("LMS Passport")
        .build()
        .expect("Failed to build client");

    let jwt = JWT::new(&config.jwt_secret);

    let state = AppState {
        client,
        pool: pool.client(),
        jwt: Arc::new(jwt),
        github_client_id: config.github_client_id,
        github_client_secret: config.github_client_secret,
    };

    #[allow(unused_variables)]
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest(
            "/api",
            OpenApiRouter::new()
                .route("/health", get(|| async { StatusCode::OK }))
                .nest("/basic", routes::basic::configure(state.clone()))
                .nest("/account", routes::account::configure(state.clone()))
                .nest("/oauth", oauth::configure(state.clone())),
        )
        .layer(CookieManagerLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .split_for_parts();

    #[cfg(feature = "swagger")]
    let router = router.merge(SwaggerUi::new("/swagger").url("/openapi.json", api));

    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));
    info!("Listening on {}", addr);

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}
