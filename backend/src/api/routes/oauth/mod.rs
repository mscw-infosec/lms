pub mod github;

use std::sync::Arc;

use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    config::Config,
    domain::{
        oauth::{providers::github::GithubProvider, service::OAuthService},
        refresh_token::service::RefreshTokenService,
    },
    infrastructure::jwt::JWT,
};

#[derive(Clone)]
pub struct GithubState {
    pub jwt: Arc<JWT>,
    pub oauth_service: Arc<OAuthService>,
    pub github_provider: GithubProvider,
    pub refresh_token_service: Arc<RefreshTokenService>,
}

pub fn configure(
    jwt: Arc<JWT>,
    client: reqwest::Client,
    oauth_service: Arc<OAuthService>,
    refresh_token_service: Arc<RefreshTokenService>,
    config: &Arc<Config>,
) -> OpenApiRouter {
    let github_provider = GithubProvider {
        client,
        client_id: config.github_client_id.clone(),
        client_secret: config.github_client_secret.clone(),
    };

    let github_state = GithubState {
        jwt,
        oauth_service,
        github_provider,
        refresh_token_service,
    };

    let github = OpenApiRouter::new()
        .routes(routes!(github::login))
        .routes(routes!(github::callback))
        .with_state(github_state);

    let yandex = OpenApiRouter::new();

    OpenApiRouter::new()
        .nest("/github", github)
        .nest("/yandex", yandex)
}
