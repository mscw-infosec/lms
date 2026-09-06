use axum::{
    Form, Json,
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Redirect,
};
use base64::{Engine, prelude::BASE64_STANDARD};
use tower_cookies::Cookies;
use tracing::info;
use url::Url;
use uuid::Uuid;

use crate::{
    domain::sso::{
        error::OAuthError,
        service::{AuthorizeParams, ClientCredentials},
    },
    dto::sso::{
        AuthorizeQuery, ConnectedAppDTO, ConsentDecisionRequest, ConsentDecisionResponse,
        ConsentRequestDTO, RevokeRequest, TokenRequest, TokenResponse,
    },
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
};

use super::SsoState;

/// `OpenID` Connect discovery document
#[utoipa::path(
    get,
    path = "/.well-known/openid-configuration",
    tag = "SSO",
    responses((status = 200, description = "OpenID Provider metadata"))
)]
pub async fn discovery(State(state): State<SsoState>) -> Json<serde_json::Value> {
    Json(state.sso_service.discovery_document())
}

/// Public keys used to sign ID tokens and access tokens
#[utoipa::path(
    get,
    path = "/jwks.json",
    tag = "SSO",
    responses((status = 200, description = "JSON Web Key Set"))
)]
pub async fn jwks(State(state): State<SsoState>) -> Json<serde_json::Value> {
    Json(state.sso_service.jwks())
}

/// Start an authorization code flow
#[utoipa::path(
    get,
    path = "/authorize",
    tag = "SSO",
    params(AuthorizeQuery),
    responses(
        (status = 302, description = "Redirect back to the client, or to the consent screen"),
        (status = 400, description = "The request could not be attributed to a registered client")
    )
)]
pub async fn authorize(
    cookies: Cookies,
    Query(query): Query<AuthorizeQuery>,
    State(state): State<SsoState>,
) -> Result<Redirect, OAuthError> {
    let user_id = session_user(&state, &cookies).await;

    let params = AuthorizeParams {
        response_type: query.response_type,
        client_id: query.client_id,
        redirect_uri: query.redirect_uri,
        scope: query.scope,
        state: query.state,
        nonce: query.nonce,
        code_challenge: query.code_challenge,
        code_challenge_method: query.code_challenge_method,
        prompt: query.prompt,
    };

    let url = state
        .sso_service
        .begin_authorization(params, user_id)
        .await?;

    Ok(Redirect::to(&url))
}

/// Exchange an authorization code or refresh token for tokens
#[utoipa::path(
    post,
    path = "/token",
    tag = "SSO",
    request_body(content = TokenRequest, content_type = "application/x-www-form-urlencoded"),
    responses(
        (status = 200, body = TokenResponse),
        (status = 400, description = "`invalid_grant` / `invalid_request` / `invalid_scope`"),
        (status = 401, description = "`invalid_client`")
    )
)]
pub async fn token(
    headers: HeaderMap,
    State(state): State<SsoState>,
    Form(request): Form<TokenRequest>,
) -> Result<Json<TokenResponse>, OAuthError> {
    let credentials = client_credentials(
        &headers,
        request.client_id.clone(),
        request.client_secret.clone(),
    )?;

    let client = state.sso_service.authenticate_client(&credentials).await?;

    let tokens = match request.grant_type.as_str() {
        "authorization_code" => {
            let code = request
                .code
                .as_deref()
                .ok_or_else(|| OAuthError::invalid_request("`code` is required"))?;

            state
                .sso_service
                .exchange_code(
                    &client,
                    code,
                    request.redirect_uri.as_deref(),
                    request.code_verifier.as_deref(),
                )
                .await?
        }
        "refresh_token" => {
            let refresh_token = request
                .refresh_token
                .as_deref()
                .ok_or_else(|| OAuthError::invalid_request("`refresh_token` is required"))?;

            state
                .sso_service
                .refresh(&client, refresh_token, request.scope.as_deref())
                .await?
        }
        other => {
            return Err(OAuthError::unsupported_grant_type(format!(
                "`{other}` is not a supported grant type"
            )));
        }
    };

    Ok(Json(tokens.into()))
}

/// Claims about the user behind an SSO access token
#[utoipa::path(
    get,
    path = "/userinfo",
    tag = "SSO",
    responses(
        (status = 200, description = "Claims allowed by the token's scopes"),
        (status = 401, description = "`invalid_token`")
    ),
    security(("BearerAuth" = []))
)]
pub async fn userinfo(
    headers: HeaderMap,
    State(state): State<SsoState>,
) -> Result<Json<serde_json::Value>, OAuthError> {
    let token = bearer_token(&headers)?;
    Ok(Json(state.sso_service.userinfo(&token).await?))
}

/// Claims about the user behind an SSO access token (POST form of `/userinfo`)
#[utoipa::path(
    post,
    path = "/userinfo",
    tag = "SSO",
    responses(
        (status = 200, description = "Claims allowed by the token's scopes"),
        (status = 401, description = "`invalid_token`")
    ),
    security(("BearerAuth" = []))
)]
pub async fn userinfo_post(
    headers: HeaderMap,
    State(state): State<SsoState>,
) -> Result<Json<serde_json::Value>, OAuthError> {
    userinfo(headers, State(state)).await
}

/// Revoke an access or refresh token (RFC 7009)
#[utoipa::path(
    post,
    path = "/revoke",
    tag = "SSO",
    request_body(content = RevokeRequest, content_type = "application/x-www-form-urlencoded"),
    responses(
        (status = 200, description = "The token is no longer valid (also when it never was)"),
        (status = 401, description = "`invalid_client`")
    )
)]
pub async fn revoke(
    headers: HeaderMap,
    State(state): State<SsoState>,
    Form(request): Form<RevokeRequest>,
) -> Result<(), OAuthError> {
    let credentials = client_credentials(&headers, request.client_id, request.client_secret)?;
    let client = state.sso_service.authenticate_client(&credentials).await?;

    state.sso_service.revoke(&client, &request.token).await?;
    Ok(())
}

/// Describe a pending authorization request for the consent screen
#[utoipa::path(
    get,
    path = "/requests/{request_id}",
    tag = "SSO",
    params(("request_id" = String, Path)),
    responses(
        (status = 200, body = ConsentRequestDTO),
        (status = 401, description = "The user is not signed in to the LMS"),
        (status = 404, description = "The request expired or was already answered")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_consent_request(
    AccessTokenClaim { sub, .. }: AccessTokenClaim,
    Path(request_id): Path<String>,
    State(state): State<SsoState>,
) -> Result<Json<ConsentRequestDTO>, OAuthError> {
    let (request, client, granted, user) =
        state.sso_service.describe_request(&request_id, sub).await?;

    let new_scopes: Vec<String> = request
        .scopes
        .iter()
        .filter(|scope| !granted.contains(scope))
        .cloned()
        .collect();

    let redirect_host = Url::parse(&request.redirect_uri)
        .ok()
        .and_then(|url| url.host_str().map(ToString::to_string))
        .unwrap_or_else(|| request.redirect_uri.clone());

    Ok(Json(ConsentRequestDTO {
        request_id,
        client_name: client.name,
        client_description: client.description,
        client_logo_url: client.logo_url,
        redirect_host,
        already_granted: new_scopes.is_empty() && !request.force_consent,
        scopes: request.scopes,
        new_scopes,
        user_email: user.email,
        user_name: user.username,
    }))
}

/// Approve or decline a pending authorization request
#[utoipa::path(
    post,
    path = "/requests/{request_id}",
    tag = "SSO",
    params(("request_id" = String, Path)),
    request_body = ConsentDecisionRequest,
    responses(
        (status = 200, body = ConsentDecisionResponse),
        (status = 401, description = "The user is not signed in to the LMS"),
        (status = 403, description = "The account is not ready to be shared"),
        (status = 404, description = "The request expired or was already answered")
    ),
    security(("BearerAuth" = []))
)]
pub async fn decide_consent(
    AccessTokenClaim { sub, .. }: AccessTokenClaim,
    Path(request_id): Path<String>,
    State(state): State<SsoState>,
    Json(decision): Json<ConsentDecisionRequest>,
) -> Result<Json<ConsentDecisionResponse>, OAuthError> {
    let redirect_to = state
        .sso_service
        .resolve_request(&request_id, sub, decision.approve)
        .await?;

    info!(user.id = %sub, approved = decision.approve, "SSO consent decision recorded");

    Ok(Json(ConsentDecisionResponse { redirect_to }))
}

/// Applications the current user has connected to their LMS account
#[utoipa::path(
    get,
    path = "/connections",
    tag = "SSO",
    responses((status = 200, body = Vec<ConnectedAppDTO>)),
    security(("BearerAuth" = []))
)]
pub async fn list_connections(
    AccessTokenClaim { sub, .. }: AccessTokenClaim,
    State(state): State<SsoState>,
) -> Result<Json<Vec<ConnectedAppDTO>>, LMSError> {
    let consents = state.sso_service.list_user_consents(sub).await?;
    Ok(Json(consents.into_iter().map(Into::into).collect()))
}

/// Disconnect an application, revoking its access immediately
#[utoipa::path(
    delete,
    path = "/connections/{client_id}",
    tag = "SSO",
    params(("client_id" = String, Path)),
    responses((status = 200, description = "The application can no longer act for this user")),
    security(("BearerAuth" = []))
)]
pub async fn revoke_connection(
    AccessTokenClaim { sub, .. }: AccessTokenClaim,
    Path(client_id): Path<String>,
    State(state): State<SsoState>,
) -> Result<(), LMSError> {
    state.sso_service.revoke_user_consent(sub, &client_id).await
}

/// Identifies the LMS user behind the browser making an `/authorize` request.
async fn session_user(state: &SsoState, cookies: &Cookies) -> Option<Uuid> {
    let claim = state.jwt.refresh_from_cookies(cookies).ok()?;

    if state
        .refresh_service
        .check_if_rotated(claim.jti)
        .await
        .unwrap_or(true)
    {
        return None;
    }

    Some(claim.sub)
}

fn bearer_token(headers: &HeaderMap) -> Result<String, OAuthError> {
    let raw = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| OAuthError::invalid_token("No bearer token was provided"))?;

    raw.strip_prefix("Bearer ")
        .or_else(|| raw.strip_prefix("bearer "))
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| OAuthError::invalid_token("Malformed Authorization header"))
}

/// Reads client credentials
fn client_credentials(
    headers: &HeaderMap,
    body_client_id: Option<String>,
    body_client_secret: Option<String>,
) -> Result<ClientCredentials, OAuthError> {
    if let Some(raw) = headers.get("authorization").and_then(|v| v.to_str().ok())
        && let Some(encoded) = raw
            .strip_prefix("Basic ")
            .or_else(|| raw.strip_prefix("basic "))
    {
        let decoded = BASE64_STANDARD
            .decode(encoded.trim())
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .ok_or_else(|| OAuthError::invalid_client("Malformed Basic credentials"))?;

        let (client_id, client_secret) = decoded
            .split_once(':')
            .ok_or_else(|| OAuthError::invalid_client("Malformed Basic credentials"))?;

        return Ok(ClientCredentials {
            client_id: client_id.to_string(),
            client_secret: Some(client_secret.to_string()).filter(|s| !s.is_empty()),
        });
    }

    let client_id = body_client_id
        .filter(|s| !s.is_empty())
        .ok_or_else(|| OAuthError::invalid_client("`client_id` is required"))?;

    Ok(ClientCredentials {
        client_id,
        client_secret: body_client_secret.filter(|s| !s.is_empty()),
    })
}
