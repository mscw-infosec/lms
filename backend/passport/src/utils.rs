use axum::{
    extract::{FromRequest, Request},
    Json,
};
use rand::{distr::Alphanumeric, Rng};
use serde::de::DeserializeOwned;
use tower_cookies::{cookie::SameSite, Cookie, Cookies};
use tracing::warn;
use validator::Validate;

use crate::errors::LMSError;

pub const MONTH: i64 = 60 * 60 * 24 * 30;

pub struct ValidatedJson<T>(pub T);

impl<S, T> FromRequest<S> for ValidatedJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Validate,
{
    type Rejection = LMSError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value): Json<T> = Json::from_request(req, state)
            .await
            .map_err(|err| LMSError::ShitHappened(err.to_string()))?;

        value.validate()?;

        Ok(Self(value))
    }
}

pub fn generate_random_string(len: usize) -> String {
    rand::rng()
        .sample_iter(Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

pub fn add_cookie(cookies: &Cookies, (name, value): (&'static str, String)) {
    let cookie = Cookie::build((name, value))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .build();

    cookies.add(cookie);
}

pub async fn send_and_parse<T: serde::de::DeserializeOwned>(
    request: reqwest::RequestBuilder,
    context: &str,
) -> Result<T, LMSError> {
    request
        .send()
        .await
        .map_err(|err| {
            warn!("Failed to send request to {} - {:?}", context, err);
            LMSError::Unknown("Internal Server Error".into())
        })?
        .json::<T>()
        .await
        .map_err(|err| {
            warn!(
                "Failed to deserialize response from {} - {:?}",
                context, err
            );
            LMSError::Unknown("Internal Server Error".into())
        })
}
