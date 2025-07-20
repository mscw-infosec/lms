use std::sync::Arc;

use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use tower_cookies::Cookies;

use crate::{
    domain::{
        account::{model::UserModel, service::AccountService},
        refresh_token::service::RefreshTokenService,
    },
    errors::LMSError,
    infrastructure::jwt::{AccessTokenClaim, RefreshTokenClaim, JWT},
};

impl<S> FromRequestParts<S> for AccessTokenClaim
where
    Arc<JWT>: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let jwt: Arc<JWT> = Arc::from_ref(state);
        let access = jwt.access_from_header(&parts.headers)?;
        Ok(access)
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
        if rt_service.check_if_rotated(refresh.jti).await? {
            return Err(LMSError::Redirect("/login"));
        }

        Ok(refresh)
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
