use std::sync::Arc;

use axum::{extract::State, Json};
use tower_cookies::Cookies;

use crate::{
    api::dto::basic::{BasicLoginRequest, BasicRegisterRequest, BasicRegisterResponse},
    errors::LMSError,
    infrastructure::jwt::{generate_tokens, Claim},
    utils::{add_cookie, ValidatedJson},
};

use super::BasicAuthState;

/// Register a new user using email, username and password
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/register",
    request_body = BasicRegisterRequest,
    responses(
        (status = 200, body = BasicRegisterResponse, description = "Create new user", headers(
            ("Set-Cookie" = String, description = "Contains the `refresh_token`")
        )),
        (status = 401, description = "User with the same email or name already exists")
    )
)]
pub async fn register(
    cookies: Cookies,
    State(state): State<Arc<BasicAuthState>>,
    ValidatedJson(payload): ValidatedJson<BasicRegisterRequest>,
) -> Result<Json<BasicRegisterResponse>, LMSError> {
    let BasicRegisterRequest {
        username,
        email,
        password,
    } = payload;

    let user = state.service.register(username, email, password).await?;
    let (refresh, access) = Claim::generate_tokens(user.id, &state.jwt_secret)?;

    add_cookie(&cookies, ("refresh_token", refresh));

    Ok(Json(BasicRegisterResponse {
        user,
        access_token: access,
    }))
}

/// Login user with email and password
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/login",
    request_body = BasicLoginRequest,
    responses(
        (status = 200, description = "Set session cookie", headers(
            ("Set-Cookie" = String, description = "Contains the `access_token`"),
            ("Set-Cookie" = String, description = "Contains the `refresh_token`")
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
    let (access, refresh) = generate_tokens(user.id, &state.jwt_secret)?;

    cookies.add(access);
    cookies.add(refresh);

    Ok(())
}
