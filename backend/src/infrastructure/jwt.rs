use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::errors::{LMSError, Result};

#[derive(Serialize, Deserialize)]
pub struct AccessTokenClaim {
    pub iss: String,
    pub sub: Uuid,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Serialize, Deserialize)]
pub struct RefreshTokenClaim {
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

    pub fn access_from_header(&self, header: &HeaderMap) -> Result<AccessTokenClaim> {
        let Some(auth) = header.get("authorization") else {
            return Err(LMSError::Unauthorized(
                "No authorization header was found.".to_string(),
            ));
        };

        let auth = auth
            .to_str()
            .map_err(|_| LMSError::Unauthorized("Wrong authorization Bearer format".to_string()))?;

        let parts: Vec<_> = auth.split(' ').collect();
        let token = parts.get(1).ok_or(LMSError::Unauthorized(
            "Wrong authorization Bearer format".to_string(),
        ))?;

        self.validate_token(token)
    }

    pub fn refresh_from_cookies(&self, cookies: &Cookies) -> Result<RefreshTokenClaim> {
        let cookie = cookies.get("refresh_token").ok_or_else(|| {
            LMSError::Unauthorized("Could not extract refresh_token from cookies".to_string())
        })?;

        let token = self.validate_token(cookie.value())?;
        Ok(token)
    }

    pub fn tokens(&self, sub: Uuid) -> Result<(String, String)> {
        let access = self.generate_access_token(sub)?;
        let refresh = self.generate_refresh_token(sub, Uuid::new_v4())?;

        Ok((access, refresh))
    }

    pub fn generate_refresh_token(&self, sub: Uuid, jti: Uuid) -> Result<String> {
        let iat = Utc::now();
        let exp = iat + Duration::days(30);

        let claim = RefreshTokenClaim {
            iss: String::from("LMS Passport"),
            sub,
            jti,
            iat: iat.timestamp(),
            exp: exp.timestamp(),
        };

        let token = encode(&Header::default(), &claim, &self.encoding_key)?;

        Ok(token)
    }

    pub fn validate_token<T: DeserializeOwned>(&self, token: &str) -> Result<T> {
        let claim = decode::<T>(
            token,
            &self.decoding_key,
            &Validation::new(Algorithm::HS256),
        )
        .map_err(|_| LMSError::Unauthorized("Invalid token format".to_string()))?;

        Ok(claim.claims)
    }

    pub fn generate_access_token(&self, sub: Uuid) -> Result<String> {
        let iat = Utc::now();
        let exp = iat + Duration::minutes(15);

        let claim = AccessTokenClaim {
            iss: String::from("LMS Passport"),
            sub,
            iat: iat.timestamp(),
            exp: exp.timestamp(),
        };

        let token = encode(&Header::default(), &claim, &self.encoding_key)?;

        Ok(token)
    }
}
