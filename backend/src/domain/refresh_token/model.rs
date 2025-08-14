use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenData {
    pub user_id: Uuid,
    pub device_id: String,
    pub issued_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub rotated: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SessionInfo {
    pub jti: Uuid,
    pub is_current: bool,
    pub device_id: String,
    pub last_used: DateTime<Utc>,
    pub issued_at: DateTime<Utc>,
}
