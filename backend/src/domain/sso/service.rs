use std::sync::Arc;

use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use tracing::info;
use url::Url;
use uuid::Uuid;

use super::{
    error::OAuthError,
    model::{
        AuthorizationCode, IdTokenClaims, NewSsoClient, PendingAuthRequest, SCOPE_ATTRIBUTES,
        SCOPE_EMAIL, SCOPE_OFFLINE_ACCESS, SCOPE_OPENID, SCOPE_PROFILE, SCOPE_ROLES,
        SUPPORTED_SCOPES, SsoAccessTokenClaims, SsoClient, SsoClientUpdate, SsoConsent,
        SsoRefreshTokenData,
    },
    repository::{SsoCacheRepository, SsoClientRepository},
};
use crate::{
    domain::account::{model::UserModel, service::AccountService},
    errors::{LMSError, Result},
    infrastructure::{crypto::Argon, sso_keys::SsoKeys},
    repo,
    utils::generate_random_string,
};

/// How long a parked `/authorize` request stays valid while the user signs in
/// and makes up their mind on the consent screen.
const REQUEST_TTL_SECS: u64 = 15 * 60;
/// Authorization codes are redeemed immediately by the relying party's server.
const CODE_TTL_SECS: u64 = 5 * 60;
const ACCESS_TOKEN_TTL_SECS: i64 = 60 * 60;
const REFRESH_TOKEN_TTL_SECS: i64 = 30 * 24 * 60 * 60;

#[derive(Debug, Clone, Default)]
pub struct AuthorizeParams {
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

pub struct CreatedClient {
    pub client: SsoClient,
    pub client_secret: Option<String>,
}

pub struct ClientCredentials {
    pub client_id: String,
    pub client_secret: Option<String>,
}

pub struct IssuedTokens {
    pub access_token: String,
    pub token_type: &'static str,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    pub scope: String,
}

#[derive(Clone)]
pub struct SsoService {
    clients: repo!(SsoClientRepository),
    cache: repo!(SsoCacheRepository),
    account: AccountService,
    keys: Arc<SsoKeys>,
    issuer: String,
    consent_url: String,
    avatar_base_url: String,
}

impl SsoService {
    pub fn new(
        clients: repo!(SsoClientRepository),
        cache: repo!(SsoCacheRepository),
        account: AccountService,
        keys: Arc<SsoKeys>,
        issuer: &str,
        frontend_base_url: &str,
        avatar_base_url: &str,
    ) -> Self {
        Self {
            clients,
            cache,
            account,
            keys,
            issuer: issuer.trim_end_matches('/').to_string(),
            consent_url: format!("{}/oauth/consent", frontend_base_url.trim_end_matches('/')),
            avatar_base_url: avatar_base_url.trim_end_matches('/').to_string(),
        }
    }

    #[must_use]
    pub fn issuer(&self) -> &str {
        &self.issuer
    }

    #[must_use]
    pub fn jwks(&self) -> serde_json::Value {
        self.keys.jwks()
    }

    #[must_use]
    pub fn discovery_document(&self) -> serde_json::Value {
        let iss = &self.issuer;
        serde_json::json!({
            "issuer": iss,
            "authorization_endpoint": format!("{iss}/authorize"),
            "token_endpoint": format!("{iss}/token"),
            "userinfo_endpoint": format!("{iss}/userinfo"),
            "jwks_uri": format!("{iss}/jwks.json"),
            "revocation_endpoint": format!("{iss}/revoke"),
            "scopes_supported": SUPPORTED_SCOPES,
            "response_types_supported": ["code"],
            "response_modes_supported": ["query"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "token_endpoint_auth_methods_supported": [
                "client_secret_basic", "client_secret_post", "none"
            ],
            "code_challenge_methods_supported": ["S256"],
            "claims_supported": [
                "sub", "iss", "aud", "exp", "iat", "auth_time", "nonce",
                "name", "preferred_username", "given_name", "family_name",
                "middle_name", "picture", "email", "email_verified",
                "role", "roles", "attributes"
            ],
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_client(
        &self,
        name: String,
        description: Option<String>,
        logo_url: Option<String>,
        redirect_uris: Vec<String>,
        post_logout_redirect_uris: Vec<String>,
        allowed_scopes: Vec<String>,
        is_public: bool,
        skip_consent: bool,
        created_by: Uuid,
    ) -> Result<CreatedClient> {
        let redirect_uris = Self::validate_redirect_uris(redirect_uris)?;
        let post_logout_redirect_uris = Self::validate_redirect_uris(post_logout_redirect_uris)?;
        let allowed_scopes = Self::validate_scopes(allowed_scopes)?;

        let client_id = format!("lms_{}", generate_random_string(24));
        let secret = if is_public {
            None
        } else {
            Some(generate_random_string(48))
        };
        let client_secret_hash = secret
            .as_ref()
            .map(|s| Argon::hash_password(s.as_bytes()))
            .transpose()?;

        let client = self
            .clients
            .create_client(&NewSsoClient {
                client_id,
                client_secret_hash,
                name,
                description,
                logo_url,
                redirect_uris,
                post_logout_redirect_uris,
                allowed_scopes,
                is_public,
                skip_consent,
                created_by,
            })
            .await?;

        info!(client_id = %client.client_id, "registered new SSO client");

        Ok(CreatedClient {
            client,
            client_secret: secret,
        })
    }

    pub async fn list_clients(&self) -> Result<Vec<SsoClient>> {
        self.clients.list_clients().await
    }

    pub async fn get_client(&self, client_id: &str) -> Result<SsoClient> {
        self.clients
            .get_client(client_id)
            .await?
            .ok_or_else(|| LMSError::NotFound("No SSO client with that client_id.".to_string()))
    }

    /// Applies a partial update. Fields left as `None` keep their current
    /// value; `description` and `logo_url` are cleared by passing an empty
    /// string.
    pub async fn update_client(
        &self,
        client_id: &str,
        mut update: SsoClientUpdate,
    ) -> Result<SsoClient> {
        if let Some(uris) = update.redirect_uris.take() {
            // Callback URLs can be changed freely, but not removed outright: a
            // client with none can never complete a login again.
            if uris.is_empty() {
                return Err(LMSError::ShitHappened(
                    "A client needs at least one redirect URI.".to_string(),
                ));
            }
            update.redirect_uris = Some(Self::validate_redirect_uris(uris)?);
        }
        if let Some(uris) = update.post_logout_redirect_uris.take() {
            update.post_logout_redirect_uris = Some(Self::validate_redirect_uris(uris)?);
        }
        if let Some(scopes) = update.allowed_scopes.take() {
            update.allowed_scopes = Some(Self::validate_scopes(scopes)?);
        }
        if let Some(logo_url) = update.logo_url.as_deref().filter(|url| !url.is_empty())
            && Url::parse(logo_url).is_err()
        {
            return Err(LMSError::ShitHappened(format!(
                "`{logo_url}` is not a valid logo URL."
            )));
        }

        self.clients.update_client(client_id, &update).await
    }

    pub async fn rotate_secret(&self, client_id: &str) -> Result<String> {
        let client = self.get_client(client_id).await?;
        if client.is_public {
            return Err(LMSError::Conflict(
                "Public clients do not have a secret.".to_string(),
            ));
        }

        let secret = generate_random_string(48);
        let hash = Argon::hash_password(secret.as_bytes())?;
        self.clients.set_client_secret(client_id, &hash).await?;

        info!(%client_id, "rotated SSO client secret");
        Ok(secret)
    }

    pub async fn delete_client(&self, client_id: &str) -> Result<()> {
        self.get_client(client_id).await?;
        self.clients.delete_client(client_id).await
    }

    pub async fn list_user_consents(&self, user_id: Uuid) -> Result<Vec<SsoConsent>> {
        self.clients.list_consents(user_id).await
    }

    pub async fn revoke_user_consent(&self, user_id: Uuid, client_id: &str) -> Result<()> {
        self.clients.delete_consent(user_id, client_id).await?;
        self.cache
            .delete_user_client_refresh(user_id, client_id)
            .await?;
        Ok(())
    }

    pub async fn begin_authorization(
        &self,
        params: AuthorizeParams,
        user_id: Option<Uuid>,
    ) -> std::result::Result<String, OAuthError> {
        let client = self.resolve_client(&params).await?;

        let prompt = params.prompt.clone().unwrap_or_default();
        let prompt_none = prompt.split_whitespace().any(|p| p == "none");
        let force_login = prompt.split_whitespace().any(|p| p == "login");

        let request = match Self::validate_request(params, &client) {
            Ok(request) => request,
            Err(redirect) => return Ok(redirect),
        };

        let bounce = |error: &str, description: &str| {
            Self::error_redirect(
                &request.redirect_uri,
                request.state.as_deref(),
                error,
                description,
            )
        };

        let Some(user_id) = user_id.filter(|_| !force_login) else {
            if prompt_none {
                return Ok(bounce("login_required", "The user is not signed in"));
            }
            return Ok(self.park(request).await?);
        };

        let user = self.account.get_user(user_id).await?;
        if !user.email_verified || !user.is_profile_complete() {
            if prompt_none {
                return Ok(bounce(
                    "interaction_required",
                    "The user must finish setting up their LMS account",
                ));
            }
            return Ok(self.park(request).await?);
        }

        if self.can_skip_consent(&client, user_id, &request).await? {
            return Ok(self.issue_code_redirect(&request, user_id).await?);
        }

        if prompt_none {
            return Ok(bounce(
                "consent_required",
                "The user has not granted the requested scopes",
            ));
        }

        Ok(self.park(request).await?)
    }

    async fn resolve_client(
        &self,
        params: &AuthorizeParams,
    ) -> std::result::Result<SsoClient, OAuthError> {
        let client_id = params
            .client_id
            .as_deref()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| OAuthError::invalid_request("`client_id` is required"))?;

        let client = self
            .clients
            .get_client(client_id)
            .await?
            .ok_or_else(|| OAuthError::invalid_client("Unknown `client_id`"))?;

        if !client.enabled {
            return Err(OAuthError::invalid_client("This client is disabled"));
        }

        let redirect_uri = params
            .redirect_uri
            .as_deref()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| OAuthError::invalid_request("`redirect_uri` is required"))?;

        if !client.allows_redirect(redirect_uri) {
            return Err(OAuthError::invalid_request(
                "`redirect_uri` is not registered for this client",
            ));
        }

        Ok(client)
    }

    fn validate_request(
        params: AuthorizeParams,
        client: &SsoClient,
    ) -> std::result::Result<PendingAuthRequest, String> {
        let redirect_uri = params.redirect_uri.unwrap_or_default();
        let state = params.state;
        let bounce = |error: &str, description: &str| {
            Self::error_redirect(&redirect_uri, state.as_deref(), error, description)
        };

        if params.response_type.as_deref() != Some("code") {
            return Err(bounce(
                "unsupported_response_type",
                "Only the authorization code flow is supported",
            ));
        }

        let scopes = Self::parse_scopes(params.scope.as_deref(), client)
            .map_err(|description| bounce("invalid_scope", &description))?;

        if !matches!(params.code_challenge_method.as_deref(), None | Some("S256")) {
            return Err(bounce(
                "invalid_request",
                "Only the S256 code challenge method is supported",
            ));
        }

        if params.code_challenge.is_none() && client.is_public {
            return Err(bounce(
                "invalid_request",
                "Public clients must use PKCE (`code_challenge`)",
            ));
        }

        Ok(PendingAuthRequest {
            client_id: client.client_id.clone(),
            redirect_uri,
            scopes,
            force_consent: params
                .prompt
                .unwrap_or_default()
                .split_whitespace()
                .any(|p| p == "consent"),
            state,
            nonce: params.nonce,
            code_challenge: params.code_challenge,
            code_challenge_method: params.code_challenge_method,
            created_at: Utc::now(),
        })
    }

    async fn park(&self, request: PendingAuthRequest) -> Result<String> {
        let request_id = generate_random_string(32);
        self.cache
            .store_request(&request_id, &request, REQUEST_TTL_SECS)
            .await?;

        Ok(format!("{}?request_id={request_id}", self.consent_url))
    }

    async fn can_skip_consent(
        &self,
        client: &SsoClient,
        user_id: Uuid,
        request: &PendingAuthRequest,
    ) -> Result<bool> {
        if request.force_consent {
            return Ok(false);
        }
        if client.skip_consent {
            return Ok(true);
        }

        let granted = self
            .clients
            .get_consent(user_id, &client.client_id)
            .await?
            .unwrap_or_default();

        Ok(request
            .scopes
            .iter()
            .all(|scope| granted.iter().any(|g| g == scope)))
    }

    pub async fn describe_request(
        &self,
        request_id: &str,
        user_id: Uuid,
    ) -> std::result::Result<(PendingAuthRequest, SsoClient, Vec<String>, UserModel), OAuthError>
    {
        let request = self
            .cache
            .get_request(request_id)
            .await?
            .ok_or_else(|| OAuthError::not_found("This authorization request has expired"))?;

        let client = self
            .clients
            .get_client(&request.client_id)
            .await?
            .ok_or_else(|| OAuthError::invalid_client("Unknown `client_id`"))?;

        let granted = self
            .clients
            .get_consent(user_id, &request.client_id)
            .await?
            .unwrap_or_default();

        let user = self.account.get_user(user_id).await?;

        Ok((request, client, granted, user))
    }

    pub async fn resolve_request(
        &self,
        request_id: &str,
        user_id: Uuid,
        approved: bool,
    ) -> std::result::Result<String, OAuthError> {
        let request = self
            .cache
            .take_request(request_id)
            .await?
            .ok_or_else(|| OAuthError::not_found("This authorization request has expired"))?;

        if !approved {
            return Ok(Self::error_redirect(
                &request.redirect_uri,
                request.state.as_deref(),
                "access_denied",
                "The user declined the request",
            ));
        }

        let user = self.account.get_user(user_id).await?;
        if !user.email_verified {
            return Err(OAuthError::access_denied(
                "Verify your email address before connecting applications",
            ));
        }
        if !user.is_profile_complete() {
            return Err(OAuthError::access_denied(
                "Complete your profile before connecting applications",
            ));
        }

        self.clients
            .upsert_consent(user_id, &request.client_id, &request.scopes)
            .await?;

        self.issue_code_redirect(&request, user_id)
            .await
            .map_err(Into::into)
    }

    async fn issue_code_redirect(
        &self,
        request: &PendingAuthRequest,
        user_id: Uuid,
    ) -> Result<String> {
        let code = generate_random_string(48);

        self.cache
            .store_code(
                &code,
                &AuthorizationCode {
                    client_id: request.client_id.clone(),
                    user_id,
                    redirect_uri: request.redirect_uri.clone(),
                    scopes: request.scopes.clone(),
                    nonce: request.nonce.clone(),
                    code_challenge: request.code_challenge.clone(),
                    code_challenge_method: request.code_challenge_method.clone(),
                    auth_time: Utc::now().timestamp(),
                },
                CODE_TTL_SECS,
            )
            .await?;

        let mut params = vec![("code".to_string(), code)];
        if let Some(state) = &request.state {
            params.push(("state".to_string(), state.clone()));
        }

        Ok(Self::append_query(&request.redirect_uri, &params))
    }

    pub async fn authenticate_client(
        &self,
        credentials: &ClientCredentials,
    ) -> std::result::Result<SsoClient, OAuthError> {
        let client = self
            .clients
            .get_client(&credentials.client_id)
            .await?
            .ok_or_else(|| OAuthError::invalid_client("Unknown `client_id`"))?;

        if !client.enabled {
            return Err(OAuthError::invalid_client("This client is disabled"));
        }

        match (&client.client_secret, &credentials.client_secret) {
            (None, _) if client.is_public => Ok(client),
            (Some(hash), Some(secret)) => {
                if Argon::verify(secret.as_bytes(), hash).unwrap_or(false) {
                    Ok(client)
                } else {
                    Err(OAuthError::invalid_client("Invalid client credentials"))
                }
            }
            _ => Err(OAuthError::invalid_client("Client authentication failed")),
        }
    }

    pub async fn exchange_code(
        &self,
        client: &SsoClient,
        code: &str,
        redirect_uri: Option<&str>,
        code_verifier: Option<&str>,
    ) -> std::result::Result<IssuedTokens, OAuthError> {
        let data = self.cache.take_code(code).await?.ok_or_else(|| {
            OAuthError::invalid_grant("The authorization code is invalid or expired")
        })?;

        if data.client_id != client.client_id {
            return Err(OAuthError::invalid_grant(
                "The authorization code was issued to another client",
            ));
        }

        if redirect_uri != Some(data.redirect_uri.as_str()) {
            return Err(OAuthError::invalid_grant("`redirect_uri` does not match"));
        }

        if let Some(challenge) = &data.code_challenge {
            let verifier = code_verifier
                .ok_or_else(|| OAuthError::invalid_grant("`code_verifier` is required"))?;

            let computed = BASE64_URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
            if &computed != challenge {
                return Err(OAuthError::invalid_grant("`code_verifier` does not match"));
            }
        }

        self.issue_tokens(
            client,
            data.user_id,
            &data.scopes,
            data.auth_time,
            data.nonce.as_deref(),
        )
        .await
        .map_err(Into::into)
    }

    pub async fn refresh(
        &self,
        client: &SsoClient,
        refresh_token: &str,
        requested_scope: Option<&str>,
    ) -> std::result::Result<IssuedTokens, OAuthError> {
        let hash = Self::hash_token(refresh_token);
        let data =
            self.cache.get_refresh(&hash).await?.ok_or_else(|| {
                OAuthError::invalid_grant("The refresh token is invalid or expired")
            })?;

        if data.client_id != client.client_id {
            return Err(OAuthError::invalid_grant(
                "The refresh token was issued to another client",
            ));
        }

        if data.expires_at < Utc::now() {
            self.cache.delete_refresh(&hash).await?;
            return Err(OAuthError::invalid_grant("The refresh token has expired"));
        }

        self.cache.delete_refresh(&hash).await?;

        let scopes = match requested_scope {
            Some(raw) => {
                let requested: Vec<String> =
                    raw.split_whitespace().map(ToString::to_string).collect();
                if requested.iter().any(|s| !data.scopes.contains(s)) {
                    return Err(OAuthError::invalid_scope(
                        "Requested scope exceeds the scope of the original grant",
                    ));
                }
                requested
            }
            None => data.scopes.clone(),
        };

        if !client.skip_consent {
            let granted = self
                .clients
                .get_consent(data.user_id, &client.client_id)
                .await?
                .unwrap_or_default();

            if scopes.iter().any(|s| !granted.contains(s)) {
                return Err(OAuthError::invalid_grant(
                    "The user has withdrawn consent for this application",
                ));
            }
        }

        self.issue_tokens(client, data.user_id, &scopes, data.auth_time, None)
            .await
            .map_err(Into::into)
    }

    async fn issue_tokens(
        &self,
        client: &SsoClient,
        user_id: Uuid,
        scopes: &[String],
        auth_time: i64,
        nonce: Option<&str>,
    ) -> Result<IssuedTokens> {
        let now = Utc::now();
        let jti = Uuid::new_v4();

        let access_token = self.keys.sign(
            &SsoAccessTokenClaims {
                iss: self.issuer.clone(),
                sub: user_id,
                aud: client.client_id.clone(),
                jti,
                scope: scopes.join(" "),
                client_id: client.client_id.clone(),
                iat: now.timestamp(),
                exp: (now + Duration::seconds(ACCESS_TOKEN_TTL_SECS)).timestamp(),
            },
            "at+jwt",
        )?;

        let id_token = if scopes.iter().any(|s| s == SCOPE_OPENID) {
            let user = self.account.get_user(user_id).await?;
            Some(self.keys.sign(
                &IdTokenClaims {
                    iss: self.issuer.clone(),
                    sub: user_id,
                    aud: client.client_id.clone(),
                    iat: now.timestamp(),
                    exp: (now + Duration::seconds(ACCESS_TOKEN_TTL_SECS)).timestamp(),
                    auth_time,
                    nonce: nonce.map(ToString::to_string),
                    profile: self.claims_for(&user, scopes),
                },
                "JWT",
            )?)
        } else {
            None
        };

        let refresh_token = if scopes.iter().any(|s| s == SCOPE_OFFLINE_ACCESS) {
            let token = generate_random_string(64);
            self.cache
                .store_refresh(
                    &Self::hash_token(&token),
                    &SsoRefreshTokenData {
                        user_id,
                        client_id: client.client_id.clone(),
                        scopes: scopes.to_vec(),
                        auth_time,
                        issued_at: now,
                        expires_at: now + Duration::seconds(REFRESH_TOKEN_TTL_SECS),
                    },
                    REFRESH_TOKEN_TTL_SECS.unsigned_abs(),
                )
                .await?;
            Some(token)
        } else {
            None
        };

        Ok(IssuedTokens {
            access_token,
            token_type: "Bearer",
            expires_in: ACCESS_TOKEN_TTL_SECS,
            refresh_token,
            id_token,
            scope: scopes.join(" "),
        })
    }

    pub async fn userinfo(
        &self,
        token: &str,
    ) -> std::result::Result<serde_json::Value, OAuthError> {
        let claims: SsoAccessTokenClaims = self
            .keys
            .verify(token, &self.issuer)
            .map_err(|e| OAuthError::invalid_token(e.to_string()))?;

        if self.cache.is_access_token_revoked(claims.jti).await? {
            return Err(OAuthError::invalid_token("This token has been revoked"));
        }

        let scopes: Vec<String> = claims
            .scope
            .split_whitespace()
            .map(ToString::to_string)
            .collect();

        let user = self.account.get_user(claims.sub).await?;

        let mut body = self.claims_for(&user, &scopes);
        if let Some(map) = body.as_object_mut() {
            map.insert("sub".to_string(), serde_json::json!(user.id));
        }

        Ok(body)
    }

    pub async fn revoke(&self, client: &SsoClient, token: &str) -> Result<()> {
        let hash = Self::hash_token(token);
        if let Some(data) = self.cache.get_refresh(&hash).await?
            && data.client_id == client.client_id
        {
            self.cache.delete_refresh(&hash).await?;
            return Ok(());
        }

        if let Ok(claims) = self
            .keys
            .verify::<SsoAccessTokenClaims>(token, &self.issuer)
            && claims.aud == client.client_id
        {
            let remaining = claims.exp - Utc::now().timestamp();
            if remaining > 0 {
                self.cache
                    .revoke_access_token(claims.jti, remaining.unsigned_abs())
                    .await?;
            }
        }

        Ok(())
    }

    fn claims_for(&self, user: &UserModel, scopes: &[String]) -> serde_json::Value {
        let has = |scope: &str| scopes.iter().any(|s| s == scope);
        let mut claims = serde_json::Map::new();

        if has(SCOPE_PROFILE) {
            claims.insert("name".to_string(), serde_json::json!(user.username));
            claims.insert(
                "preferred_username".to_string(),
                serde_json::json!(user.username),
            );
            claims.insert("given_name".to_string(), serde_json::json!(user.first_name));
            claims.insert("family_name".to_string(), serde_json::json!(user.last_name));
            claims.insert(
                "middle_name".to_string(),
                serde_json::json!(user.patronymic),
            );
            claims.insert(
                "picture".to_string(),
                serde_json::json!(format!("{}/avatars/{}", self.avatar_base_url, user.id)),
            );
            claims.insert(
                "updated_at".to_string(),
                serde_json::json!(user.created_at.timestamp()),
            );
        }

        if has(SCOPE_EMAIL) {
            claims.insert("email".to_string(), serde_json::json!(user.email));
            claims.insert(
                "email_verified".to_string(),
                serde_json::json!(user.email_verified),
            );
        }

        if has(SCOPE_ROLES) {
            claims.insert("role".to_string(), serde_json::json!(user.role));
            claims.insert("roles".to_string(), serde_json::json!([user.role]));
        }

        if has(SCOPE_ATTRIBUTES) {
            claims.insert("attributes".to_string(), serde_json::json!(user.attributes));
        }

        serde_json::Value::Object(claims)
    }

    fn parse_scopes(
        raw: Option<&str>,
        client: &SsoClient,
    ) -> std::result::Result<Vec<String>, String> {
        let mut scopes: Vec<String> = raw
            .unwrap_or(SCOPE_OPENID)
            .split_whitespace()
            .map(ToString::to_string)
            .collect();

        if scopes.is_empty() {
            scopes.push(SCOPE_OPENID.to_string());
        }

        scopes.dedup();

        for scope in &scopes {
            if !SUPPORTED_SCOPES.contains(&scope.as_str()) {
                return Err(format!("Unknown scope `{scope}`"));
            }
            if !client.allows_scope(scope) {
                return Err(format!("Scope `{scope}` is not allowed for this client"));
            }
        }

        Ok(scopes)
    }

    fn validate_scopes(scopes: Vec<String>) -> Result<Vec<String>> {
        if scopes.is_empty() {
            return Err(LMSError::ShitHappened(
                "A client must allow at least one scope.".to_string(),
            ));
        }

        for scope in &scopes {
            if !SUPPORTED_SCOPES.contains(&scope.as_str()) {
                return Err(LMSError::ShitHappened(format!("Unknown scope `{scope}`.")));
            }
        }

        Ok(scopes)
    }

    fn validate_redirect_uris(uris: Vec<String>) -> Result<Vec<String>> {
        for uri in &uris {
            let parsed = Url::parse(uri).map_err(|_| {
                LMSError::ShitHappened(format!("`{uri}` is not a valid absolute URL."))
            })?;

            if parsed.fragment().is_some() {
                return Err(LMSError::ShitHappened(format!(
                    "Redirect URI `{uri}` must not contain a fragment."
                )));
            }

            let host = parsed.host_str().unwrap_or_default();
            let loopback = matches!(host, "localhost" | "127.0.0.1" | "[::1]" | "::1");
            if parsed.scheme() == "http" && !loopback {
                return Err(LMSError::ShitHappened(format!(
                    "Redirect URI `{uri}` must use https (http is only allowed for localhost)."
                )));
            }
        }

        Ok(uris)
    }

    fn hash_token(token: &str) -> String {
        format!("{:x}", Sha256::digest(token.as_bytes()))
    }

    fn error_redirect(
        redirect_uri: &str,
        state: Option<&str>,
        error: &str,
        description: &str,
    ) -> String {
        let mut params = vec![
            ("error".to_string(), error.to_string()),
            ("error_description".to_string(), description.to_string()),
        ];
        if let Some(state) = state {
            params.push(("state".to_string(), state.to_string()));
        }

        Self::append_query(redirect_uri, &params)
    }

    fn append_query(redirect_uri: &str, params: &[(String, String)]) -> String {
        let Ok(mut url) = Url::parse(redirect_uri) else {
            let separator = if redirect_uri.contains('?') { '&' } else { '?' };
            let query = params
                .iter()
                .map(|(k, v)| format!("{k}={}", urlencode(v)))
                .collect::<Vec<_>>()
                .join("&");
            return format!("{redirect_uri}{separator}{query}");
        };

        url.query_pairs_mut()
            .extend_pairs(params.iter().map(|(k, v)| (k.as_str(), v.as_str())));
        url.to_string()
    }
}

fn urlencode(value: &str) -> String {
    value
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}
