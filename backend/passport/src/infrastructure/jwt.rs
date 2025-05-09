use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use tower_cookies::{cookie::SameSite, Cookie};
use uuid::Uuid;

use crate::{
    errors::{LMSError, Result},
    utils::MONTH,
};

#[derive(Serialize, Deserialize)]
pub struct Claim {
    pub id: Uuid,
    pub iat: i64,
    pub exp: i64,
}

impl Claim {
    pub fn new(id: Uuid, seconds: i64) -> Self {
        let iat = Utc::now();
        let exp = iat + Duration::seconds(seconds);

        Self {
            id,
            iat: iat.timestamp(),
            exp: exp.timestamp(),
        }
    }

    pub fn encode(&self, key: &str) -> Result<String> {
        encode(
            &Header::new(Algorithm::HS256),
            &self,
            &EncodingKey::from_secret(key.as_bytes()),
        )
        .map_err(LMSError::InvalidToken)
    }

    pub fn validate_token(token: &str, key: &str) -> Result<Self> {
        decode::<Self>(
            token,
            &DecodingKey::from_secret(key.as_bytes()),
            &Validation::new(Algorithm::HS256),
        )
        .map(|data| data.claims)
        .map_err(LMSError::InvalidToken)
    }

    pub fn generate_tokens(id: Uuid, key: &str) -> Result<(String, String)> {
        let refresh_token = Self::new(id, MONTH).encode(key)?;
        let access_token = Self::new(id, 15 * 60).encode(key)?;

        Ok((refresh_token, access_token))
    }
}

pub fn generate_tokens(id: Uuid, key: &str) -> Result<(Cookie<'static>, Cookie<'static>)> {
    let refresh_token = Claim::new(id, MONTH).encode(key)?;
    let access_token = Claim::new(id, 15 * 60).encode(key)?;

    let refresh = Cookie::build(("refresh_token", refresh_token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .build();

    let access = Cookie::build(("access_token", access_token))
        .path("/")
        .http_only(true)
        .secure(true)
        .same_site(SameSite::Lax)
        .build();

    Ok((access, refresh))
}

pub fn claim_from_header(header: &HeaderMap, key: &str) -> Result<Claim> {
    let Some(auth) = header.get("authorization") else {
        return Err(LMSError::Forbidden(
            "No authorization header was found.".to_string(),
        ));
    };

    let auth = auth
        .to_str()
        .map_err(|_| LMSError::ShitHappened("Wrong authorization Bearer format".to_string()))?;

    let parts: Vec<_> = auth.split(' ').collect();
    let token = parts.get(1).ok_or(LMSError::ShitHappened(
        "Wrong authorization Bearer format".to_string(),
    ))?;

    Claim::validate_token(token, key)
}
