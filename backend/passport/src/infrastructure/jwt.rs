use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::LMSError;

const JWT_EXPIRY_HOURS: i64 = 5;

#[derive(Serialize, Deserialize)]
pub struct Claim {
    pub id: Uuid,
    pub iat: i64,
    pub exp: i64,
}

impl Claim {
    pub fn new(id: Uuid) -> Self {
        let iat = Utc::now();
        let exp = iat + Duration::hours(JWT_EXPIRY_HOURS);

        Self {
            id,
            iat: iat.timestamp(),
            exp: exp.timestamp(),
        }
    }

    pub fn encode(&self, key: &str) -> Result<String, LMSError> {
        encode(
            &Header::new(Algorithm::HS256),
            &self,
            &EncodingKey::from_secret(key.as_bytes()),
        )
        .map_err(LMSError::InvalidToken)
    }
}
