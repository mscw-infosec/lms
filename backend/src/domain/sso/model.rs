use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;

pub const SCOPE_OPENID: &str = "openid";
pub const SCOPE_PROFILE: &str = "profile";
pub const SCOPE_EMAIL: &str = "email";
pub const SCOPE_ROLES: &str = "roles";
pub const SCOPE_ATTRIBUTES: &str = "attributes";
pub const SCOPE_OFFLINE_ACCESS: &str = "offline_access";

pub const SUPPORTED_SCOPES: [&str; 6] = [
    SCOPE_OPENID,
    SCOPE_PROFILE,
    SCOPE_EMAIL,
    SCOPE_ROLES,
    SCOPE_ATTRIBUTES,
    SCOPE_OFFLINE_ACCESS,
];

#[derive(Debug, Clone, FromRow)]
pub struct SsoClient {
    pub id: Uuid,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub redirect_uris: Vec<String>,
    pub post_logout_redirect_uris: Vec<String>,
    pub allowed_scopes: Vec<String>,
    pub is_public: bool,
    pub skip_consent: bool,
    pub enabled: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SsoClient {
    #[must_use]
    pub fn allows_redirect(&self, uri: &str) -> bool {
        self.redirect_uris.iter().any(|u| u == uri)
    }

    #[must_use]
    pub fn allows_scope(&self, scope: &str) -> bool {
        self.allowed_scopes.iter().any(|s| s == scope)
    }
}

#[derive(Debug, Clone)]
pub struct NewSsoClient {
    pub client_id: String,
    pub client_secret_hash: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub redirect_uris: Vec<String>,
    pub post_logout_redirect_uris: Vec<String>,
    pub allowed_scopes: Vec<String>,
    pub is_public: bool,
    pub skip_consent: bool,
    pub created_by: Uuid,
}

#[derive(Debug, Clone, Default)]
pub struct SsoClientUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub redirect_uris: Option<Vec<String>>,
    pub post_logout_redirect_uris: Option<Vec<String>>,
    pub allowed_scopes: Option<Vec<String>>,
    pub skip_consent: Option<bool>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct SsoConsent {
    pub client_id: String,
    pub client_name: String,
    pub client_logo_url: Option<String>,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingAuthRequest {
    pub client_id: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub state: Option<String>,
    pub nonce: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub force_consent: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationCode {
    pub client_id: String,
    pub user_id: Uuid,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub nonce: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub auth_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoRefreshTokenData {
    pub user_id: Uuid,
    pub client_id: String,
    pub scopes: Vec<String>,
    pub auth_time: i64,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SsoAccessTokenClaims {
    pub iss: String,
    pub sub: Uuid,
    pub aud: String,
    pub jti: Uuid,
    pub scope: String,
    pub client_id: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IdTokenClaims {
    pub iss: String,
    pub sub: Uuid,
    pub aud: String,
    pub iat: i64,
    pub exp: i64,
    pub auth_time: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(flatten)]
    pub profile: serde_json::Value,
}
