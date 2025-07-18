#![deny(clippy::unwrap_used)]
#![warn(clippy::all, clippy::pedantic, clippy::nursery)]
#![allow(
    clippy::missing_errors_doc,
    clippy::must_use_candidate,
    clippy::missing_panics_doc,
    clippy::wildcard_imports,
    clippy::significant_drop_tightening,
    // TODO: fix this warning
    clippy::result_large_err
)]

use crate::{
    config::Config,
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        oauth::service::OAuthService, refresh_token::service::RefreshTokenService,
        video::service::VideoService,
    },
    infrastructure::{
        db::postgres::{RepositoryPostgres, run_migrations},
        iam::IAMTokenManager,
        logging::init_tracing,
        s3::S3Manager,
    },
};

use axum::{http::StatusCode, routing::get};
use infrastructure::{db::redis::RepositoryRedis, jwt::JWT};
use openapi::ApiDoc;
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
pub mod dto;
pub mod errors;
pub mod infrastructure;
pub mod macros;
pub mod openapi;
pub mod utils;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let config = Config::from_env()?;

    let db_repo = Arc::new(RepositoryPostgres::new(&config.database_url).await?);
    run_migrations(&db_repo).await?;

    let s3 = S3Manager::new(config.clone()).await?;
    let jwt = Arc::new(JWT::new(&config.jwt_secret));
    let iam = IAMTokenManager::new(&config.iam_key_file)?;
    let rdb_repo = Arc::new(RepositoryRedis::new(&config.redis_url).await?);
    let client = reqwest::Client::builder()
        .user_agent("LMS Backend")
        .build()
        .expect("Failed to build client");

    let account_service = AccountService::new(db_repo.clone(), rdb_repo.clone(), s3.clone());
    let basic_auth_service = BasicAuthService::new(db_repo.clone());
    let oauth_service = OAuthService::new(db_repo.clone());
    let refresh_token_service = RefreshTokenService::new(rdb_repo.clone(), jwt.clone());
    let video_service = VideoService::new(db_repo.clone(), config.channel_id.clone(), iam)?;

    #[allow(unused_variables)]
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest(
            "/api",
            OpenApiRouter::new()
                .route("/health", get(|| async { StatusCode::OK }))
                .nest(
                    "/account",
                    api::account::configure(account_service.clone(), jwt.clone()),
                )
                .nest(
                    "/auth",
                    api::auth::configure(refresh_token_service.clone(), jwt.clone()),
                )
                .nest(
                    "/basic",
                    api::basic::configure(
                        basic_auth_service,
                        refresh_token_service.clone(),
                        jwt.clone(),
                    ),
                )
                .nest(
                    "/oauth",
                    api::oauth::configure(
                        jwt.clone(),
                        client,
                        oauth_service,
                        refresh_token_service,
                        config.clone(),
                    ),
                )
                .nest(
                    "/video",
                    api::video::configure(video_service, account_service, jwt)?,
                ),
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
