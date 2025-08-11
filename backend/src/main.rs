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
    app::{generate_router, Services},
    config::Config,
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        courses::service::CourseService, exam::service::ExamService, oauth::service::OAuthService,
        refresh_token::service::RefreshTokenService, task::service::TaskService,
        topics::service::TopicService, video::service::VideoService,
    },
    infrastructure::{
        db::postgres::{run_migrations, RepositoryPostgres},
        iam::IAMTokenManager,
        logging::init_tracing,
        s3::S3Manager,
    },
};

use axum::{http::StatusCode, routing::get};
use axum::http::{header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE}, Method};
use infrastructure::{db::redis::RepositoryRedis, jwt::JWT};
use openapi::ApiDoc;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_cookies::CookieManagerLayer;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
};
use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;

#[cfg(feature = "swagger")]
use utoipa_swagger_ui::SwaggerUi;

mod gen_openapi;

pub mod api;
pub mod app;
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
    gen_openapi::save_openapi()?;

    init_tracing();

    let config = Config::from_env()?;
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));

    let db_repo = Arc::new(RepositoryPostgres::new(&config.database_url).await?);
    run_migrations(&db_repo).await?;

    let client = reqwest::Client::builder()
        .user_agent("LMS Backend")
        .build()
        .expect("Failed to build client");

    let s3 = Arc::new(S3Manager::new(config.clone(), client.clone()).await?);
    let jwt = Arc::new(JWT::new(&config.jwt_secret));
    let iam = Arc::new(IAMTokenManager::new(&config.iam_key_file)?);
    let rdb_repo = Arc::new(RepositoryRedis::new(&config.redis_url).await?);

    let account = AccountService::new(
        db_repo.clone(),
        rdb_repo.clone(),
        s3.clone(),
        &config.frontend_redirect_url,
    );
    let basic_auth = BasicAuthService::new(db_repo.clone());
    let course = CourseService::new(db_repo.clone());
    let exam = ExamService::new(db_repo.clone());
    let oauth = OAuthService::new(db_repo.clone(), s3.clone());
    let refresh_token = RefreshTokenService::new(rdb_repo.clone(), jwt.clone());
    let task = TaskService::new(db_repo.clone());
    let topic = TopicService::new(db_repo.clone());
    let video = VideoService::new(db_repo.clone(), config.channel_id.clone(), iam)?;

    let services = Services {
        account,
        basic_auth,
        course,
        exam,
        oauth,
        refresh_token,
        task,
        topic,
        video,
    };

    let app_router = generate_router(jwt, client, config, services)?;

    #[allow(unused_variables)]
    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest("/api", app_router)
        .layer(CookieManagerLayer::new())
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().include_headers(true))
                .on_response(DefaultOnResponse::new().include_headers(true)),
        )
        .layer(CompressionLayer::new())
        .layer(
            CorsLayer::new()
                .allow_origin([
                    "http://localhost:3000".parse().expect("valid CORS origin URL"),
                    "http://127.0.0.1:3000".parse().expect("valid CORS origin URL"),
                ])
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::PATCH,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers([ACCEPT, AUTHORIZATION, CONTENT_TYPE])
                .allow_credentials(true),
        )
        .split_for_parts();

    #[cfg(feature = "swagger")]
    let router = router.merge(SwaggerUi::new("/swagger").url("/openapi.json", api));

    info!("Listening on {}", addr);

    let listener = TcpListener::bind(&addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}
