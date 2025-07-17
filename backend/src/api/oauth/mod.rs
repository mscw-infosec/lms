pub mod github;
pub mod yandex;

use std::sync::Arc;

use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    config::Config,
    domain::{
        oauth::{
            providers::{github::GithubProvider, yandex::YandexProvider},
            service::OAuthService,
        },
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

#[derive(Clone)]
pub struct YandexState {
    pub jwt: Arc<JWT>,
    pub oauth_service: Arc<OAuthService>,
    pub yandex_provider: YandexProvider,
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
        client: client.clone(),
        client_id: config.github_client_id.clone(),
        client_secret: config.github_client_secret.clone(),
    };

    let github_state = GithubState {
        jwt: jwt.clone(),
        oauth_service: oauth_service.clone(),
        github_provider,
        refresh_token_service: refresh_token_service.clone(),
    };

    let github = OpenApiRouter::new()
        .routes(routes!(github::login))
        .routes(routes!(github::callback))
        .with_state(github_state);

    let yandex_provider = YandexProvider {
        client,
        client_id: config.yandex_client_id.clone(),
        client_secret: config.yandex_client_secret.clone(),
    };

    let yandex_state = YandexState {
        jwt,
        oauth_service,
        yandex_provider,
        refresh_token_service,
    };

    let yandex = OpenApiRouter::new()
        .routes(routes!(yandex::login))
        .routes(routes!(yandex::callback))
        .with_state(yandex_state);

    OpenApiRouter::new()
        .nest("/github", github)
        .nest("/yandex", yandex)
}
