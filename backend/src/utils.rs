use std::{collections::HashMap, hash::BuildHasher};

use axum::{
    Json,
    extract::{FromRequest, Request},
};
use rand::{Rng, distr::Alphanumeric};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::json;
use tower_cookies::{Cookie, Cookies, cookie::SameSite};
use tracing::warn;
use validator::Validate;

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
    add_cookie(cookies, (name, String::new()));
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
    let json_map = map.into_iter().map(|(k, v)| (k, json!(v))).collect();
    let value = serde_json::Value::Object(json_map);

    serde_json::from_value(value)
}
