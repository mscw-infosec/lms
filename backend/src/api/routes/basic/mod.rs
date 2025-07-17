use std::sync::Arc;

use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::{basic::service::BasicAuthService, refresh_token::service::RefreshTokenService},
    infrastructure::jwt::JWT,
};

pub mod routes;

#[derive(Clone)]
pub struct BasicAuthState {
    pub basic_auth_service: Arc<BasicAuthService>,
    pub refresh_service: Arc<RefreshTokenService>,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    basic_auth_service: Arc<BasicAuthService>,
    refresh_service: Arc<RefreshTokenService>,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = BasicAuthState {
        basic_auth_service,
        refresh_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(login))
        .with_state(state)
}
