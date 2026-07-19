use std::{collections::HashMap, hash::BuildHasher};

use axum::extract::Query;
use axum::http::HeaderMap;
use axum::{
    Json,
    extract::{FromRequest, Request},
};
use rand::{Rng, distr::Alphanumeric};
use serde::{Serialize, de::DeserializeOwned};
use tower_cookies::{Cookie, Cookies, cookie::SameSite};
use tracing::warn;
use validator::Validate;

use crate::domain::refresh_token::model::DeviceInfo;
use crate::errors::LMSError;

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

pub struct ValidatedQuery<T>(pub T);

impl<S, T> FromRequest<S> for ValidatedQuery<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Validate,
{
    type Rejection = LMSError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Query(value): Query<T> = Query::from_request(req, state)
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

pub fn remove_cookie(cookies: &Cookies, name: &'static str) {
    let cookie = Cookie::build((name, "")).removal().build();
    cookies.remove(cookie);
}

/// Builds a fresh [`DeviceInfo`] fingerprint from request headers.
///
/// Uses the `User-Agent` plus the client IP (`X-Forwarded-For` first hop,
/// falling back to `X-Real-IP`). Used at login/OAuth to identify the session.
#[must_use]
pub fn device_from_headers(headers: &HeaderMap) -> DeviceInfo {
    let header_str = |name: &str| {
        headers
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToString::to_string)
    };

    let user_agent = header_str("user-agent");
    let ip = header_str("x-forwarded-for")
        .map(|xff| {
            // X-Forwarded-For may be a comma-separated list; the client is first.
            xff.split(',').next().unwrap_or(&xff).trim().to_string()
        })
        .or_else(|| header_str("x-real-ip"));

    DeviceInfo::new(user_agent, ip)
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

pub fn to_pairs<T: Serialize>(s: &T) -> Vec<(String, String)> {
    let json = serde_json::to_value(s).expect("s implement Serialize");
    match json {
        serde_json::Value::Object(map) => {
            map.into_iter().map(|(k, v)| (k, v.to_string())).collect()
        }
        _ => vec![],
    }
}

pub fn from_pairs<T, S>(map: HashMap<String, String, S>) -> serde_json::Result<T>
where
    T: DeserializeOwned,
    S: BuildHasher,
{
    let json_map = map
        .into_iter()
        .map(|(k, v)| {
            (
                k,
                serde_json::from_str(&v)
                    .unwrap_or_else(|_| panic!("Failed to parse Redis value as JSON: {v}")),
            )
        })
        .collect();

    let value = serde_json::Value::Object(json_map);
    serde_json::from_value(value)
}
