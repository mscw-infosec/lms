use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
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
