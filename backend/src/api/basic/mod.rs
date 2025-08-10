use std::sync::Arc;

use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::domain::account::service::AccountService;
use crate::{
    domain::{basic::service::BasicAuthService, refresh_token::service::RefreshTokenService},
    infrastructure::jwt::JWT,
};

pub mod routes;

#[derive(Clone)]
pub struct BasicAuthState {
    pub account_service: AccountService,
    pub basic_auth_service: BasicAuthService,
    pub refresh_service: RefreshTokenService,
    pub jwt: Arc<JWT>,
}

pub fn configure(
    account_service: AccountService,
    basic_auth_service: BasicAuthService,
    refresh_service: RefreshTokenService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = BasicAuthState {
        account_service,
        basic_auth_service,
        refresh_service,
        jwt,
    };

    OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(login))
        .with_state(state)
}
