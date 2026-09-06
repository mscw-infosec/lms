pub mod clients;
pub mod routes;
use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::{refresh_token::service::RefreshTokenService, sso::service::SsoService},
    infrastructure::jwt::JWT,
};

#[derive(FromRef, Clone)]
pub struct SsoState {
    pub sso_service: SsoService,
    pub refresh_service: RefreshTokenService,
    pub jwt: Arc<JWT>,
}

#[must_use]
pub fn is_cross_origin_path(path: &str) -> bool {
    matches!(
        path,
        "/api/sso/token"
            | "/api/sso/userinfo"
            | "/api/sso/revoke"
            | "/api/sso/jwks.json"
            | "/api/sso/.well-known/openid-configuration"
    )
}

pub fn configure(
    sso_service: SsoService,
    refresh_service: RefreshTokenService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = SsoState {
        sso_service,
        refresh_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(routes::discovery))
        .routes(routes!(routes::jwks))
        .routes(routes!(routes::authorize))
        .routes(routes!(routes::token))
        .routes(routes!(routes::userinfo, routes::userinfo_post))
        .routes(routes!(routes::revoke))
        .routes(routes!(routes::get_consent_request, routes::decide_consent))
        .routes(routes!(routes::list_connections))
        .routes(routes!(routes::revoke_connection))
        .routes(routes!(clients::metadata))
        .routes(routes!(clients::create_client, clients::list_clients))
        .routes(routes!(
            clients::get_client,
            clients::update_client,
            clients::delete_client
        ))
        .routes(routes!(clients::rotate_secret))
        .with_state(state)
}
