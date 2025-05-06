#![deny(clippy::unwrap_used)]
#![warn(clippy::all, clippy::pedantic, clippy::nursery)]
#![allow(
    clippy::missing_errors_doc,
    clippy::must_use_candidate,
    clippy::missing_panics_doc,
    clippy::wildcard_imports
)]

use crate::{
    api::routes,
    config::Config,
    infrastructure::{
        db::postgres::{run_migrations, PostgresClient},
        logging::init_tracing,
    },
};

use axum::{http::StatusCode, routing::get};
use openapi::ApiDoc;
use sqlx::PgPool;
use std::net::SocketAddr;
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
    secret: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = Config::from_env()?;

    let pool = PostgresClient::new(config.database_url()).await?;
    run_migrations(&pool).await?;

    let state = AppState {
        pool: pool.client(),
        secret: config.jwt_secret().to_string(),
    };

    #[allow(unused_variables)]
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .route("/health", get(|| async { StatusCode::OK }))
        .nest("/basic", routes::basic::configure(state.clone()))
        .nest("/account", routes::account::configure(state.clone()))
        .layer(CookieManagerLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .split_for_parts();

    #[cfg(feature = "swagger")]
    let router = router.merge(SwaggerUi::new("/swagger").url("/openapi.json", api));

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port()));
    info!("Listening on {}", addr);

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}
