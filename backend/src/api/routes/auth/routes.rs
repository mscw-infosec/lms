use axum::{
    Json,
    extract::{Path, State},
};
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::{
    domain::refresh_token::model::SessionInfo,
    dto::auth::RefreshResponse,
    errors::LMSError,
    infrastructure::jwt::{AccessTokenClaim, RefreshTokenClaim},
    utils::add_cookie,
};

use super::AuthState;

/// Return new access and refresh tokens
#[utoipa::path(
    post,
    path = "/refresh",
    tag = "Auth",
    responses(
        (status = 200, body = RefreshResponse),
        (status = 401, description = "Invalid or expired refresh token")
    ),
    security(
        ("CookieAuth" = [])
    )
)]
pub async fn refresh(
    cookies: Cookies,
    token: RefreshTokenClaim,
    State(state): State<AuthState>,
) -> Result<Json<RefreshResponse>, LMSError> {
    let (new_refresh_token, _) = state.refresh_service.validate_and_rotate(&token).await?;
    let access_token = state.jwt.generate_access_token(token.sub)?;

    add_cookie(&cookies, ("refresh_token", new_refresh_token));

    Ok(Json(RefreshResponse { access_token }))
}

/// Return information for all active sessions (refresh tokens)
#[utoipa::path(
    get,
    path = "/sessions",
    tag = "Auth",
    responses(
        (status = 200, body = Vec<SessionInfo>),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn get_sessions(
    token: AccessTokenClaim,
    State(state): State<AuthState>,
) -> Result<Json<Vec<SessionInfo>>, LMSError> {
    let user_id = token.sub;
    let sessions = state.refresh_service.get_user_sessions(user_id).await?;
    Ok(Json(sessions))
}

/// Revoke refresh token with jti passed to path parameters
#[utoipa::path(
    post,
    path = "/logout-session/{jti}",
    tag = "Auth",
    responses(
        (status = 200, description = "Session logged out successfully"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn logout_session(
    token: AccessTokenClaim,
    Path(jti): Path<Uuid>,
    State(state): State<AuthState>,
) -> Result<(), LMSError> {
    state.refresh_service.logout_session(token.sub, jti).await
}

/// Invalidate all refresh tokens
#[utoipa::path(
    post,
    path = "/logout-all",
    tag = "Auth",
    responses(
        (status = 200, description = "All sessions logged out successfully"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn logout_all(
    token: AccessTokenClaim,
    State(state): State<AuthState>,
) -> Result<(), LMSError> {
    let user_id = token.sub;
    state.refresh_service.logout_all_sessions(user_id).await
}
