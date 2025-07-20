use axum::{extract::State, Json};
use tower_cookies::Cookies;

use crate::{
    dto::basic::{
        BasicLoginRequest, BasicLoginResponse, BasicRegisterRequest, BasicRegisterResponse,
    },
    errors::LMSError,
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
    State(state): State<BasicAuthState>,
    ValidatedJson(payload): ValidatedJson<BasicRegisterRequest>,
) -> Result<Json<BasicRegisterResponse>, LMSError> {
    let BasicRegisterRequest {
        username,
        email,
        password,
    } = payload;

    let user = state
        .basic_auth_service
        .register(username, email, password)
        .await?;

    let (refresh_token, _) = state.refresh_service.create_refresh_token(user.id).await?;
    let access_token = state.jwt.generate_access_token(user.id)?;

    add_cookie(&cookies, ("refresh_token", refresh_token));

    Ok(Json(BasicRegisterResponse { access_token }))
}

/// Login user with email and password
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/login",
    request_body = BasicLoginRequest,
    responses(
        (status = 200, body = BasicLoginResponse, description = "Returns access and refresh tokens", headers(
            ("Set-Cookie" = String, description = "Contains the `refresh_token`")
        )),
        (status = 403, description = "Wrong email or password")
    )
)]
pub async fn login(
    cookies: Cookies,
    State(state): State<BasicAuthState>,
    Json(payload): Json<BasicLoginRequest>,
) -> Result<Json<BasicLoginResponse>, LMSError> {
    let BasicLoginRequest { username, password } = payload;

    let user = state.basic_auth_service.login(username, password).await?;

    let (refresh_token, _) = state.refresh_service.create_refresh_token(user.id).await?;
    let access_token = state.jwt.generate_access_token(user.id)?;

    add_cookie(&cookies, ("refresh_token", refresh_token));

    Ok(Json(BasicLoginResponse { access_token }))
}
