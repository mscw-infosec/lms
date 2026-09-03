use axum::{Json, extract::State, http::HeaderMap};
use tower_cookies::Cookies;
use tracing::{error, warn};

use crate::{
    dto::basic::{
        BasicLoginRequest, BasicLoginResponse, BasicRegisterRequest, BasicRegisterResponse,
        ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest,
    },
    errors::LMSError,
    utils::{ValidatedJson, add_cookie, device_from_headers},
};

use super::BasicAuthState;

/// Register a new user with their name, email and password.
///
/// The account is created immediately (and the user is logged in), but their
/// email starts out unverified, so feature routes stay gated until they open
/// the verification link sent to their inbox.
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/register",
    request_body = BasicRegisterRequest,
    responses(
        (status = 200, body = BasicRegisterResponse, description = "Create new user", headers(
            ("Set-Cookie" = String, description = "Contains the `refresh_token`")
        )),
        (status = 409, description = "User with the same email already exists")
    )
)]
pub async fn register(
    cookies: Cookies,
    headers: HeaderMap,
    State(state): State<BasicAuthState>,
    ValidatedJson(payload): ValidatedJson<BasicRegisterRequest>,
) -> Result<Json<BasicRegisterResponse>, LMSError> {
    let BasicRegisterRequest {
        last_name,
        first_name,
        patronymic,
        email,
        password,
    } = payload;

    let email = email.to_lowercase();

    let user = state
        .basic_auth_service
        .register(
            first_name,
            last_name,
            patronymic,
            email.clone(),
            password,
        )
        .await?;

    // Fire off the verification email. A failure here shouldn't block the
    // account creation itself — the user can resend from their account page —
    // but it must be loud in the logs (email is otherwise a silent side effect).
    if let Err(err) = state
        .account_service
        .send_verification_email(user.id, &user.email)
        .await
    {
        error!(
            user.id = %user.id,
            recipient = %email,
            error = ?err,
            "registration succeeded but the verification email could not be sent"
        );
    }

    let (refresh_token, _) = state
        .refresh_service
        .create_refresh_token(user.id, device_from_headers(&headers))
        .await?;
    // Freshly registered: email not yet verified, profile complete (names given).
    let access_token = state
        .jwt
        .generate_access_token(user.id, user.role, false, true)?;

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
    headers: HeaderMap,
    State(state): State<BasicAuthState>,
    Json(payload): Json<BasicLoginRequest>,
) -> Result<Json<BasicLoginResponse>, LMSError> {
    let BasicLoginRequest { email, password } = payload;

    let user = state
        .basic_auth_service
        .login(email.to_lowercase(), password)
        .await?;

    let (refresh_token, _) = state
        .refresh_service
        .create_refresh_token(user.id, device_from_headers(&headers))
        .await?;

    let profile_complete =
        !user.first_name.trim().is_empty() && !user.last_name.trim().is_empty();
    let access_token = state.jwt.generate_access_token(
        user.id,
        user.role,
        user.email_verified,
        profile_complete,
    )?;

    add_cookie(&cookies, ("refresh_token", refresh_token));

    Ok(Json(BasicLoginResponse { access_token }))
}

/// Verify an email address from the token embedded in the verification link.
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/verify-email",
    request_body = VerifyEmailRequest,
    responses(
        (status = 200, description = "Email verified successfully"),
        (status = 404, description = "Invalid or expired verification link")
    )
)]
pub async fn verify_email(
    State(state): State<BasicAuthState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<(), LMSError> {
    state.account_service.verify_email(&payload.token).await?;
    Ok(())
}

/// Request a password-reset link.
///
/// Always returns 200 regardless of whether an account exists, so the endpoint
/// can't be used to probe which emails are registered.
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/forgot-password",
    request_body = ForgotPasswordRequest,
    responses(
        (status = 200, description = "If an account exists, a reset link has been sent")
    )
)]
pub async fn forgot_password(
    State(state): State<BasicAuthState>,
    ValidatedJson(payload): ValidatedJson<ForgotPasswordRequest>,
) -> Result<(), LMSError> {
    state
        .basic_auth_service
        .request_password_reset(&payload.email.to_lowercase())
        .await?;
    Ok(())
}

/// Reset a password using the token from the recovery link.
///
/// On success the user's other sessions are revoked, and — since clicking the
/// emailed link proves ownership of the mailbox — their email is marked verified.
#[utoipa::path(
    post,
    tag = "Basic",
    path = "/reset-password",
    request_body = ResetPasswordRequest,
    responses(
        (status = 200, description = "Password reset successfully"),
        (status = 404, description = "Invalid or expired reset link")
    )
)]
pub async fn reset_password(
    State(state): State<BasicAuthState>,
    ValidatedJson(payload): ValidatedJson<ResetPasswordRequest>,
) -> Result<(), LMSError> {
    let user_id = state
        .basic_auth_service
        .reset_password(&payload.token, &payload.new_password)
        .await?;

    if let Err(err) = state.account_service.mark_email_verified(user_id).await {
        warn!("Failed to mark email verified after reset for {user_id}: {err:?}");
    }

    state
        .refresh_service
        .logout_all_sessions(user_id)
        .await?;

    Ok(())
}
