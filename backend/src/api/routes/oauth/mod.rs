pub mod github;

use std::sync::Arc;

use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    AppState,
    domain::{
        oauth::{providers::github::GithubProvider, service::OAuthService},
        refresh_token::service::RefreshTokenService,
    },
    infrastructure::{
        db::{
            postgres::repositories::oauth_repo::OAuthRepositoryPostgres,
            redis::repositories::refresh_token_repo::RefreshTokenRepositoryRedis,
        },
        jwt::JWT,
    },
};

pub struct GithubState {
    pub service: OAuthService,
    pub provider: GithubProvider,
    pub refresh_service: RefreshTokenService,
    pub jwt: JWT,
}

pub fn configure(state: AppState) -> OpenApiRouter {
    let oauth_repo = OAuthRepositoryPostgres { pool: state.pool };
    let service = OAuthService::new(Box::new(oauth_repo));

    let github_provider = GithubProvider {
        client: state.client,
        client_id: state.github_client_id,
        client_secret: state.github_client_secret,
    };

    let refresh_repo = RefreshTokenRepositoryRedis::new(state.rdb);
    let refresh_service = RefreshTokenService::new(Box::new(refresh_repo), state.jwt.clone());

    let github_state = GithubState {
        service,
        provider: github_provider,
        refresh_service,
        jwt: state.jwt,
    };

    let github = OpenApiRouter::new()
        .routes(routes!(github::login))
        .routes(routes!(github::callback))
        .with_state(Arc::new(github_state));

    let yandex = OpenApiRouter::new();

    OpenApiRouter::new()
        .nest("/github", github)
        .nest("/yandex", yandex)
}
