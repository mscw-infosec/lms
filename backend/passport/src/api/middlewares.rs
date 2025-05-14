use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use tower_cookies::Cookies;

use crate::{
    errors::LMSError,
    infrastructure::jwt::{AccessTokenClaim, RefreshTokenClaim, JWT},
};

impl<S> FromRequestParts<S> for AccessTokenClaim
where
    JWT: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let jwt = JWT::from_ref(state);
        let access = jwt.access_from_header(&parts.headers)?;
        Ok(access)
    }
}

impl<S> FromRequestParts<S> for RefreshTokenClaim
where
    JWT: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = LMSError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let cookies = Cookies::from_request_parts(parts, state)
            .await
            .map_err(|_| {
                LMSError::Unauthorized("Could not extract cookies from request".to_string())
            })?;

        let jwt = JWT::from_ref(state);
        let refresh = jwt.refresh_from_cookies(&cookies)?;
        Ok(refresh)
    }
}
