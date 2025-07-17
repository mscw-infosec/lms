use std::sync::Arc;

use axum_macros::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{domain::refresh_token::service::RefreshTokenService, infrastructure::jwt::JWT};

pub mod routes;

#[derive(FromRef, Clone)]
pub struct AuthState {
    pub refresh_service: Arc<RefreshTokenService>,
    pub jwt: Arc<JWT>,
}

pub fn configure(refresh_service: Arc<RefreshTokenService>, jwt: Arc<JWT>) -> OpenApiRouter {
    let auth_state = AuthState {
        refresh_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(routes::refresh))
        .routes(routes!(routes::get_sessions))
        .routes(routes!(routes::logout_session))
        .routes(routes!(routes::logout_all))
        .with_state(auth_state)
}
