use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    domain::{
        account::model::UserRole,
        sso::model::{SUPPORTED_SCOPES, SsoClientUpdate},
    },
    dto::sso::{
        ClientSecretDTO, CreateClientRequest, CreatedClientDTO, SsoClientDTO, SsoMetadataDTO,
        UpdateClientRequest,
    },
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
    utils::ValidatedJson,
};

use super::SsoState;

fn require_admin(role: UserRole) -> Result<(), LMSError> {
    if role == UserRole::Admin {
        return Ok(());
    }

    Err(LMSError::Forbidden(
        "Only admins can manage SSO clients".to_string(),
    ))
}

/// Endpoint URLs to hand to a relying party
#[utoipa::path(
    get,
    path = "/metadata",
    tag = "SSO",
    responses(
        (status = 200, body = SsoMetadataDTO),
        (status = 403, description = "Only admins can manage SSO clients")
    ),
    security(("BearerAuth" = []))
)]
pub async fn metadata(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    State(state): State<SsoState>,
) -> Result<Json<SsoMetadataDTO>, LMSError> {
    require_admin(role)?;

    let issuer = state.sso_service.issuer().to_string();
    Ok(Json(SsoMetadataDTO {
        discovery_url: format!("{issuer}/.well-known/openid-configuration"),
        authorization_endpoint: format!("{issuer}/authorize"),
        token_endpoint: format!("{issuer}/token"),
        userinfo_endpoint: format!("{issuer}/userinfo"),
        jwks_uri: format!("{issuer}/jwks.json"),
        revocation_endpoint: format!("{issuer}/revoke"),
        scopes_supported: SUPPORTED_SCOPES.iter().map(ToString::to_string).collect(),
        issuer,
    }))
}

/// Register an application that may authenticate users with their LMS account
#[utoipa::path(
    post,
    path = "/clients",
    tag = "SSO",
    request_body = CreateClientRequest,
    responses(
        (status = 200, body = CreatedClientDTO, description = "Includes the one-time client secret"),
        (status = 400, description = "Invalid redirect URI or scope"),
        (status = 403, description = "Only admins can manage SSO clients")
    ),
    security(("BearerAuth" = []))
)]
pub async fn create_client(
    AccessTokenClaim { sub, role, .. }: AccessTokenClaim,
    State(state): State<SsoState>,
    ValidatedJson(payload): ValidatedJson<CreateClientRequest>,
) -> Result<Json<CreatedClientDTO>, LMSError> {
    require_admin(role)?;

    let created = state
        .sso_service
        .create_client(
            payload.name,
            payload.description,
            payload.logo_url,
            payload.redirect_uris,
            payload.post_logout_redirect_uris,
            payload.allowed_scopes,
            payload.is_public,
            payload.skip_consent,
            sub,
        )
        .await?;

    Ok(Json(CreatedClientDTO {
        client: created.client.into(),
        client_secret: created.client_secret,
    }))
}

/// List registered relying parties
#[utoipa::path(
    get,
    path = "/clients",
    tag = "SSO",
    responses(
        (status = 200, body = Vec<SsoClientDTO>),
        (status = 403, description = "Only admins can manage SSO clients")
    ),
    security(("BearerAuth" = []))
)]
pub async fn list_clients(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    State(state): State<SsoState>,
) -> Result<Json<Vec<SsoClientDTO>>, LMSError> {
    require_admin(role)?;

    let clients = state.sso_service.list_clients().await?;
    Ok(Json(clients.into_iter().map(Into::into).collect()))
}

/// Return a single relying party
#[utoipa::path(
    get,
    path = "/clients/{client_id}",
    tag = "SSO",
    params(("client_id" = String, Path)),
    responses(
        (status = 200, body = SsoClientDTO),
        (status = 403, description = "Only admins can manage SSO clients"),
        (status = 404, description = "No client with that client_id")
    ),
    security(("BearerAuth" = []))
)]
pub async fn get_client(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(client_id): Path<String>,
    State(state): State<SsoState>,
) -> Result<Json<SsoClientDTO>, LMSError> {
    require_admin(role)?;

    let client = state.sso_service.get_client(&client_id).await?;
    Ok(Json(client.into()))
}

/// Update a relying party
#[utoipa::path(
    patch,
    path = "/clients/{client_id}",
    tag = "SSO",
    params(("client_id" = String, Path)),
    request_body = UpdateClientRequest,
    responses(
        (status = 200, body = SsoClientDTO),
        (status = 400, description = "Invalid redirect URI or scope"),
        (status = 403, description = "Only admins can manage SSO clients"),
        (status = 404, description = "No client with that client_id")
    ),
    security(("BearerAuth" = []))
)]
pub async fn update_client(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(client_id): Path<String>,
    State(state): State<SsoState>,
    ValidatedJson(payload): ValidatedJson<UpdateClientRequest>,
) -> Result<Json<SsoClientDTO>, LMSError> {
    require_admin(role)?;

    let client = state
        .sso_service
        .update_client(
            &client_id,
            SsoClientUpdate {
                name: payload.name,
                description: payload.description,
                logo_url: payload.logo_url,
                redirect_uris: payload.redirect_uris,
                post_logout_redirect_uris: payload.post_logout_redirect_uris,
                allowed_scopes: payload.allowed_scopes,
                skip_consent: payload.skip_consent,
                enabled: payload.enabled,
            },
        )
        .await?;

    Ok(Json(client.into()))
}

/// Delete a relying party, dropping every consent and token issued to it
#[utoipa::path(
    delete,
    path = "/clients/{client_id}",
    tag = "SSO",
    params(("client_id" = String, Path)),
    responses(
        (status = 200, description = "Client removed"),
        (status = 403, description = "Only admins can manage SSO clients"),
        (status = 404, description = "No client with that client_id")
    ),
    security(("BearerAuth" = []))
)]
pub async fn delete_client(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(client_id): Path<String>,
    State(state): State<SsoState>,
) -> Result<(), LMSError> {
    require_admin(role)?;

    state.sso_service.delete_client(&client_id).await
}

/// Issue a new client secret, invalidating the current one
#[utoipa::path(
    post,
    path = "/clients/{client_id}/secret",
    tag = "SSO",
    params(("client_id" = String, Path)),
    responses(
        (status = 200, body = ClientSecretDTO, description = "The new secret, shown once"),
        (status = 403, description = "Only admins can manage SSO clients"),
        (status = 404, description = "No client with that client_id"),
        (status = 409, description = "Public clients have no secret")
    ),
    security(("BearerAuth" = []))
)]
pub async fn rotate_secret(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(client_id): Path<String>,
    State(state): State<SsoState>,
) -> Result<Json<ClientSecretDTO>, LMSError> {
    require_admin(role)?;

    let client_secret = state.sso_service.rotate_secret(&client_id).await?;
    Ok(Json(ClientSecretDTO { client_secret }))
}
