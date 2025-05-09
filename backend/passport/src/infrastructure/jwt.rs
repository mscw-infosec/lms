use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{LMSError, Result};

#[derive(Serialize, Deserialize)]
pub struct AccessClaim {
    pub iss: String,
    pub sub: Uuid,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Serialize, Deserialize)]
pub struct RefreshToken {
    pub iss: String,
    pub sub: Uuid,
    pub jti: Uuid,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Clone)]
pub struct JWT {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl JWT {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
        }
    }

    pub fn refresh_from_header(&self, header: &HeaderMap) -> Result<RefreshToken> {
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

        let claim = decode::<RefreshToken>(
            token,
            &self.decoding_key,
            &Validation::new(Algorithm::HS256),
        )
        .map(|data| data.claims)?;

        Ok(claim)
    }

    pub fn tokens(&self, sub: Uuid) -> Result<(String, String)> {
        let access = self.generate_access_token(sub)?;
        let refresh = self.generate_refresh_token(sub)?;

        Ok((access, refresh))
    }

    pub fn generate_refresh_token(&self, sub: Uuid) -> Result<String> {
        let jti = Uuid::new_v4();
        let iat = Utc::now();
        let exp = iat + Duration::seconds(15 * 24 * 60 * 60); // 15 days

        let claim = RefreshToken {
            iss: String::from("LMS Passport"),
            sub,
            jti,
            iat: iat.timestamp(),
            exp: exp.timestamp(),
        };

        let token = encode(&Header::default(), &claim, &self.encoding_key)?;

        Ok(token)
    }

    pub fn generate_access_token(&self, sub: Uuid) -> Result<String> {
        let iat = Utc::now();
        let exp = iat + Duration::seconds(15 * 60);

        let claim = AccessClaim {
            iss: String::from("LMS Passport"),
            sub,
            iat: iat.timestamp(),
            exp: exp.timestamp(),
        };

        let token = encode(&Header::default(), &claim, &self.encoding_key)?;

        Ok(token)
    }
}
