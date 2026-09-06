use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use validator::Validate;

use crate::domain::sso::{
    model::{SsoClient, SsoConsent},
    service::IssuedTokens,
};

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
pub struct AuthorizeQuery {
    pub response_type: Option<String>,
    pub client_id: Option<String>,
    pub redirect_uri: Option<String>,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub nonce: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub prompt: Option<String>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct TokenRequest {
    pub grant_type: String,
    pub code: Option<String>,
    pub redirect_uri: Option<String>,
    pub code_verifier: Option<String>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,
    pub scope: String,
}

impl From<IssuedTokens> for TokenResponse {
    fn from(value: IssuedTokens) -> Self {
        Self {
            access_token: value.access_token,
            token_type: value.token_type.to_string(),
            expires_in: value.expires_in,
            refresh_token: value.refresh_token,
            id_token: value.id_token,
            scope: value.scope,
        }
    }
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct RevokeRequest {
    pub token: String,
    pub token_type_hint: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConsentRequestDTO {
    pub request_id: String,
    pub client_name: String,
    pub client_description: Option<String>,
    pub client_logo_url: Option<String>,
    pub redirect_host: String,
    pub scopes: Vec<String>,
    pub new_scopes: Vec<String>,
    pub user_email: String,
    pub user_name: String,
    pub already_granted: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ConsentDecisionRequest {
    pub approve: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConsentDecisionResponse {
    pub redirect_to: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConnectedAppDTO {
    pub client_id: String,
    pub name: String,
    pub logo_url: Option<String>,
    pub scopes: Vec<String>,
    pub granted_at: DateTime<Utc>,
}

impl From<SsoConsent> for ConnectedAppDTO {
    fn from(value: SsoConsent) -> Self {
        Self {
            client_id: value.client_id,
            name: value.client_name,
            logo_url: value.client_logo_url,
            scopes: value.scopes,
            granted_at: value.granted_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema, Validate)]
pub struct CreateClientRequest {
    #[validate(length(min = 1, max = 200, message = "Name is required"))]
    pub name: String,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    #[validate(url)]
    pub logo_url: Option<String>,
    #[validate(length(min = 1, message = "At least one redirect URI is required"))]
    pub redirect_uris: Vec<String>,
    #[serde(default)]
    pub post_logout_redirect_uris: Vec<String>,
    #[validate(length(min = 1, message = "At least one scope is required"))]
    pub allowed_scopes: Vec<String>,
    #[serde(default)]
    pub is_public: bool,
    #[serde(default)]
    pub skip_consent: bool,
}

#[derive(Debug, Deserialize, ToSchema, Validate)]
pub struct UpdateClientRequest {
    #[validate(length(min = 1, max = 200))]
    pub name: Option<String>,
    #[validate(length(max = 1000))]
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub redirect_uris: Option<Vec<String>>,
    pub post_logout_redirect_uris: Option<Vec<String>>,
    pub allowed_scopes: Option<Vec<String>>,
    pub skip_consent: Option<bool>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SsoClientDTO {
    pub client_id: String,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub redirect_uris: Vec<String>,
    pub post_logout_redirect_uris: Vec<String>,
    pub allowed_scopes: Vec<String>,
    pub is_public: bool,
    pub skip_consent: bool,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SsoClient> for SsoClientDTO {
    fn from(value: SsoClient) -> Self {
        Self {
            client_id: value.client_id,
            name: value.name,
            description: value.description,
            logo_url: value.logo_url,
            redirect_uris: value.redirect_uris,
            post_logout_redirect_uris: value.post_logout_redirect_uris,
            allowed_scopes: value.allowed_scopes,
            is_public: value.is_public,
            skip_consent: value.skip_consent,
            enabled: value.enabled,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreatedClientDTO {
    #[serde(flatten)]
    pub client: SsoClientDTO,
    pub client_secret: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ClientSecretDTO {
    pub client_secret: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SsoMetadataDTO {
    pub issuer: String,
    pub discovery_url: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub userinfo_endpoint: String,
    pub jwks_uri: String,
    pub revocation_endpoint: String,
    pub scopes_supported: Vec<String>,
}
