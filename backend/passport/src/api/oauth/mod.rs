pub mod github;

use std::sync::Arc;

use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::oauth::{providers::github::GithubProvider, service::OAuthService},
    infrastructure::{db::postgres::repositories::oauth_repo::OAuthRepositoryPostgres, jwt::JWT},
    AppState,
};

pub struct GithubState {
    pub service: OAuthService,
    pub provider: GithubProvider,
    pub jwt: JWT,
}

pub fn configure(state: AppState) -> OpenApiRouter {
    let repository = OAuthRepositoryPostgres { pool: state.pool };
    let service = OAuthService::new(Box::new(repository));

    let github_provider = GithubProvider {
        client: state.client,
        client_id: state.github_client_id,
        client_secret: state.github_client_secret,
    };

    let github_state = Arc::new(GithubState {
        service,
        provider: github_provider,
        jwt: state.jwt,
    });

    let github = OpenApiRouter::new()
        .routes(routes!(github::login))
        .routes(routes!(github::callback))
        .with_state(github_state);

    let yandex = OpenApiRouter::new();

    OpenApiRouter::new()
        .nest("/github", github)
        .nest("/yandex", yandex)
}
