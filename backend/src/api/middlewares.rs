use std::sync::Arc;

use axum::extract::Request;
use axum::{
    extract::{FromRef, FromRequestParts, State},
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use tower_cookies::Cookies;

use crate::dto::account::CtfdToken;
use crate::{
    domain::{
        account::{model::UserModel, service::AccountService},
        refresh_token::service::RefreshTokenService,
    },
    errors::LMSError,
    infrastructure::jwt::{AccessTokenClaim, JWT, RefreshTokenClaim},
};

impl<S> FromRequestParts<S> for AccessTokenClaim
where
    Arc<JWT>: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    #[allow(clippy::unused_async_trait_impl)]
    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let jwt: Arc<JWT> = Arc::from_ref(state);
        let access = jwt.access_from_header(&parts.headers)?;
        Ok(access)
    }
}

impl<S> FromRequestParts<S> for CtfdToken
where
    Arc<JWT>: FromRef<S>,
    S: Send + Sync + HasCtfdAuthData,
{
    type Rejection = LMSError;

    #[allow(clippy::unused_async_trait_impl)]
    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        if let Some(ctfd_token) = parts.headers.get("X-CTFd-Token")
            && let Ok(token) = ctfd_token.to_str()
        {
            if token != state.get_ctfd_auth_token() {
                return Err(LMSError::Forbidden("Wrong CTFd token >:(".to_string()));
            }
            return Ok(Self {
                token: token.to_string(),
            });
        }

        Err(LMSError::Unauthorized(
            "No CTFd token found >:(".to_string(),
        ))
    }
}

impl<S> FromRequestParts<S> for RefreshTokenClaim
where
    Arc<JWT>: FromRef<S>,
    RefreshTokenService: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let cookies = Cookies::from_request_parts(parts, state)
            .await
            .map_err(|_| {
                LMSError::Unauthorized("Could not extract cookies from request".to_string())
            })?;

        let jwt: Arc<JWT> = Arc::from_ref(state);
        let refresh = jwt.refresh_from_cookies(&cookies)?;

        let rt_service = RefreshTokenService::from_ref(state);
        if !rt_service.is_usable(refresh.jti).await? {
            return Err(LMSError::Unauthorized(
                "Refresh token is no longer valid".to_string(),
            ));
        }

        Ok(refresh)
    }
}

pub struct RefreshCookie(pub RefreshTokenClaim);

impl<S> FromRequestParts<S> for RefreshCookie
where
    Arc<JWT>: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let cookies = Cookies::from_request_parts(parts, state)
            .await
            .map_err(|_| {
                LMSError::Unauthorized("Could not extract cookies from request".to_string())
            })?;

        let jwt: Arc<JWT> = Arc::from_ref(state);
        Ok(Self(jwt.refresh_from_cookies(&cookies)?))
    }
}

impl<S> FromRequestParts<S> for UserModel
where
    Arc<JWT>: FromRef<S>,
    AccountService: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let jwt: Arc<JWT> = Arc::from_ref(state);
        let service = AccountService::from_ref(state);

        let access = jwt.access_from_header(&parts.headers)?;
        let user = service.get_user(access.sub).await?;

        Ok(user)
    }
}

pub trait HasCtfdAuthData {
    fn get_ctfd_auth_token(&self) -> String;
}

pub async fn email_gate(
    State(jwt): State<Arc<JWT>>,
    request: Request,
    next: Next,
) -> Result<Response, LMSError> {
    if let Ok(claim) = jwt.access_from_header(request.headers()) {
        if !claim.email_verified {
            return Err(LMSError::EmailNotVerified);
        }
        if !claim.profile_complete {
            return Err(LMSError::ProfileIncomplete);
        }
    }

    Ok(next.run(request).await)
}
