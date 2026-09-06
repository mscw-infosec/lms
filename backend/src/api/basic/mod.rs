use std::sync::Arc;

use routes::*;
use utoipa_axum::{router::OpenApiRouter, routes};
use structured_email_address::Config as EmailConfig;

use crate::{
    domain::{
        account::service::AccountService, basic::service::BasicAuthService,
        refresh_token::service::RefreshTokenService,
    },
    infrastructure::{captcha::SmartCaptchaService, jwt::JWT},
};

pub mod routes;

#[derive(Clone)]
pub struct BasicAuthState {
    pub basic_auth_service: BasicAuthService,
    pub account_service: AccountService,
    pub refresh_service: RefreshTokenService,
    pub captcha_service: SmartCaptchaService,
    pub jwt: Arc<JWT>,
    pub email_config: EmailConfig
}

pub fn configure(
    basic_auth_service: BasicAuthService,
    account_service: AccountService,
    refresh_service: RefreshTokenService,
    captcha_service: SmartCaptchaService,
    jwt: Arc<JWT>,
) -> OpenApiRouter {
    let state = BasicAuthState {
        basic_auth_service,
        account_service,
        refresh_service,
        captcha_service,
        jwt,
        email_config: EmailConfig::builder()
            .strip_subaddress()
            .build()
    };

    OpenApiRouter::new()
        .routes(routes!(register))
        .routes(routes!(login))
        .routes(routes!(verify_email))
        .routes(routes!(forgot_password))
        .routes(routes!(reset_password))
        .with_state(state)
}
