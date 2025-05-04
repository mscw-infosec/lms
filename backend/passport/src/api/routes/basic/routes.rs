use std::sync::Arc;

use axum::extract::State;
use tower_cookies::{cookie::SameSite, Cookie, Cookies};

use crate::{
    api::dto::basic::BasicRegisterRequest, errors::LMSError, infrastructure::jwt::Claim,
    utils::ValidatedJson,
};

use super::BasicAuthState;

/// Use this API to register a new user using email, username and password
#[utoipa::path(
    post,
    path = "/register",
    tag = "Basic",
    request_body = BasicRegisterRequest,
    responses(
        (status = 200, description = "Create user and set session cookie", headers(
            ("Set-Cookie" = String, description = "Contains the session cookie named `session`.")
        )),
        (status = 401, body = String, description = "User with the same email or name already exists")
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
