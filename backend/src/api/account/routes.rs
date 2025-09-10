use crate::dto::account::{CtfdAccountData, CtfdToken};
use crate::{
    api::account::AccountState,
    domain::account::model::{Attributes, UserModel, UserRole},
    dto::account::{AvatarUploadResponse, CtfdStatus, GetUserResponseDTO, PublicAccountDTO},
    dto::task::LimitOffsetDTO,
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
    utils::ValidatedQuery,
};
use axum::{
    Json,
    extract::{Path, State},
};
use uuid::Uuid;

/// Return user object
#[utoipa::path(
    get,
    path = "/",
    tag = "Account",
    responses(
        (status = 200, body = GetUserResponseDTO),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_user(user: UserModel) -> Result<Json<GetUserResponseDTO>, LMSError> {
    Ok(Json(user.into()))
}

/// Return user attributes (only for admins)
#[utoipa::path(
    get,
    path = "/{user_id}/attributes",
    tag = "Account",
    params(
        ("user_id" = Uuid, Path)
    ),
    responses(
        (status = 200, body = Attributes),
        (status = 403, description = "Only admins can view user attributes"),
        (status = 404, description = "No user was found with that id")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_user_attributes(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(user_id): Path<Uuid>,
    State(state): State<AccountState>,
) -> Result<Json<Attributes>, LMSError> {
    if role != UserRole::Admin {
        return Err(LMSError::Forbidden(
            "Only admins can view user attributes".into(),
        ));
    }

    let user = state.account_service.get_user(user_id).await?;
    Ok(Json(user.attributes))
}

/// Return user attributes (for `CTFd` integration)
#[utoipa::path(
    get,
    path = "/{user_email}/ctfd-data",
    tag = "Account",
    params(
        ("user_email" = String, Path)
    ),
    responses(
        (status = 200, body = CtfdAccountData),
        (status = 403, description = "Only admins can view user attributes"),
        (status = 404, description = "No user was found with that id")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn get_user_ctfd_data(
    _: CtfdToken, // need for ctfd auth, don't remove
    Path(user_email): Path<String>,
    State(state): State<AccountState>,
) -> Result<Json<CtfdAccountData>, LMSError> {
    let user = state.account_service.get_user_by_email(user_email).await?;
    Ok(Json(CtfdAccountData {
        attributes: user.attributes,
        active_attempt_task_ids: state
            .account_service
            .get_user_active_ctfd_tasks(user.id)
            .await?,
    }))
}

/// Upsert attributes to user (only for admins)
#[utoipa::path(
    patch,
    path = "/{user_id}/attributes",
    tag = "Account",
    responses(
        (status = 200, body = Attributes),
        (status = 403, description = "Only admins can update user attributes"),
        (status = 404, description = "No user found with that ID")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn upsert_user_attributes(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(user_id): Path<Uuid>,
    State(state): State<AccountState>,
    Json(attributes): Json<Attributes>,
) -> Result<Json<Attributes>, LMSError> {
    if role != UserRole::Admin {
        return Err(LMSError::Forbidden(
            "Only admins can update user attributes".into(),
        ));
    }

    let attributes = state
        .account_service
        .upsert_attributes(user_id, attributes)
        .await?;

    Ok(Json(attributes))
}

/// Delete attribute from user (only for admins)
#[utoipa::path(
    delete,
    path = "/{user_id}/attributes/{key}",
    tag = "Account",
    params(
        ("user_id" = Uuid, Path),
        ("key" = String, Path)
    ),
    responses(
        (status = 204, description = "Attribute deleted successfully"),
        (status = 403, description = "Only admins can delete user attributes"),
        (status = 404, description = "No attribute found with that key")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn delete_user_attribute(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path((user_id, key)): Path<(Uuid, String)>,
    State(state): State<AccountState>,
) -> Result<(), LMSError> {
    if role != UserRole::Admin {
        return Err(LMSError::Forbidden(
            "Only admins can delete user attributes".into(),
        ));
    }

    state
        .account_service
        .delete_attribute(user_id, &key)
        .await?;

    Ok(())
}

/// Generate presigned url to upload avatar
#[utoipa::path(
    put,
    path = "/avatar",
    tag = "Account",
    responses(
        (status = 200, body = AvatarUploadResponse, description = "Return presigned url to upload avatar")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn upload_avatar(
    user: AccessTokenClaim,
    State(state): State<AccountState>,
) -> Result<Json<AvatarUploadResponse>, LMSError> {
    let presigned = state.account_service.presigned_url(user.sub).await?;
    Ok(Json(presigned.into()))
}

/// Check if user is registered in `CTFd`
#[utoipa::path(
    get,
    path = "/ctfd",
    tag = "Account",
    responses(
        (status = 200, body = CtfdStatus),
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn check_ctfd(
    user: UserModel,
    State(state): State<AccountState>,
) -> Result<Json<CtfdStatus>, LMSError> {
    Ok(Json(CtfdStatus {
        status: state.account_service.get_ctfd(user.email).await?,
    }))
}

/// List accounts with public data and attributes (admin only)
#[utoipa::path(
    get,
    tag = "Account",
    path = "/list",
    description = "List all accounts. Limit <= 20.",
    params(
        ("limit" = i32, Query),
        ("offset" = i32, Query)
    ),
    responses(
        (status = 200, description = "Successfully got accounts list", body = [PublicAccountDTO]),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "Only admins can list accounts")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn list_accounts(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    State(state): State<AccountState>,
    ValidatedQuery(query): ValidatedQuery<LimitOffsetDTO>,
) -> Result<Json<Vec<PublicAccountDTO>>, LMSError> {
    if role != UserRole::Admin {
        return Err(LMSError::Forbidden("Only admins can list accounts".into()));
    }

    let users = state
        .account_service
        .list_accounts(query.limit, query.offset)
        .await?;

    Ok(Json(users.into_iter().map(Into::into).collect()))
}
