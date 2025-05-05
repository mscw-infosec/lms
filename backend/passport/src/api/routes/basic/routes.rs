use std::sync::Arc;

use axum::{extract::State, Json};
use tower_cookies::{cookie::SameSite, Cookie, Cookies};

use crate::{
    api::dto::basic::{BasicLoginRequest, BasicRegisterRequest},
    errors::LMSError,
    infrastructure::jwt::Claim,
    utils::ValidatedJson,
};

use super::BasicAuthState;

/// Register a new user using email, username and password
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/register",
    request_body = BasicRegisterRequest,
    responses(
        (status = 200, description = "Create user and set session cookie", headers(
            ("Set-Cookie" = String, description = "Contains the session cookie named `token`.")
        )),
        (status = 401, description = "User with the same email or name already exists")
    )
)]
pub async fn register(
    cookies: Cookies,
    State(state): State<Arc<BasicAuthState>>,
    ValidatedJson(payload): ValidatedJson<BasicRegisterRequest>,
) -> Result<(), LMSError> {
    let BasicRegisterRequest {
        username,
        email,
        password,
    } = payload;

    let user = state.service.register(username, email, password).await?;
    let token = Claim::new(user.id).encode(&state.jwt_secret)?;

    let cookie = Cookie::build(("token", token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .build();

    cookies.add(cookie);

    Ok(())
}

/// Login user with email and password
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/login",
    request_body = BasicLoginRequest,
    responses(
        (status = 200, description = "Set session cookie", headers(
            ("Set-Cookie" = String, description = "Contains the session cookie named `token`.")
        )),
        (status = 403, description = "Wrong email or password")
    )
)]
pub async fn login(
    cookies: Cookies,
    State(state): State<Arc<BasicAuthState>>,
    Json(payload): Json<BasicLoginRequest>,
) -> Result<(), LMSError> {
    let BasicLoginRequest { username, password } = payload;

    let user = state.service.login(username, password).await?;
    let token = Claim::new(user.id).encode(&state.jwt_secret)?;

    let cookie = Cookie::build(("token", token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .build();

    cookies.add(cookie);

    Ok(())
}
