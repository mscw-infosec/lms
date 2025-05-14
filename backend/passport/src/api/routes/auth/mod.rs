use std::sync::Arc;

use axum::extract::FromRef;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    domain::refresh_token::service::RefreshTokenService,
    infrastructure::{
        db::redis::repositories::refresh_token_repo::RefreshTokenRepositoryRedis, jwt::JWT,
    },
    AppState,
};

pub mod routes;

pub struct AuthState {
    pub refresh_service: RefreshTokenService,
    pub jwt: JWT,
}

pub fn configure(state: AppState) -> OpenApiRouter {
    let repo = RefreshTokenRepositoryRedis::new(state.rdb);
    let refresh_service = RefreshTokenService::new(Box::new(repo), state.jwt.clone());

    let auth_state = Arc::new(AuthState {
        refresh_service,
        jwt: state.jwt,
    });

    OpenApiRouter::new()
        .routes(routes!(routes::refresh))
        .routes(routes!(routes::get_sessions))
        .routes(routes!(routes::logout_session))
        .routes(routes!(routes::logout_all))
        .with_state(auth_state)
}

impl FromRef<Arc<AuthState>> for JWT {
    fn from_ref(input: &Arc<AuthState>) -> Self {
        input.jwt.clone()
    }
}
