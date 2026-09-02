use crate::dto::account::{CtfdAccountData, CtfdToken, UpdateProfileRequest};
use crate::{
    api::account::AccountState,
    domain::account::model::{Attributes, UserModel, UserRole},
    dto::account::{
        AccountListQuery, AvatarUploadResponse, CtfdStatus, GetUserResponseDTO, PagedAccountsDTO,
        UpdateUserRoleDTO,
    },
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
    utils::{ValidatedJson, ValidatedQuery},
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
pub async fn get_user(
    user: UserModel,
    State(state): State<AccountState>,
) -> Result<Json<GetUserResponseDTO>, LMSError> {
    state
        .account_service
        .assign_predefined_attributes(user.id, user.email.to_lowercase().clone())
        .await?;
    Ok(Json(user.into()))
}

/// Update the current user's names (profile edit / OAuth detail completion)
#[utoipa::path(
    patch,
    path = "/profile",
    tag = "Account",
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, body = GetUserResponseDTO, description = "Updated user profile"),
        (status = 401, description = "No auth data found")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn update_profile(
    AccessTokenClaim { sub, .. }: AccessTokenClaim,
    State(state): State<AccountState>,
    ValidatedJson(payload): ValidatedJson<UpdateProfileRequest>,
) -> Result<Json<GetUserResponseDTO>, LMSError> {
    let user = state
        .account_service
        .update_profile(
            sub,
            payload.first_name.trim(),
            payload.last_name.trim(),
            payload
                .patronymic
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty()),
        )
        .await?;

    Ok(Json(user.into()))
}

/// Resend the email-verification link to the current user
#[utoipa::path(
    post,
    path = "/resend-verification",
    tag = "Account",
    responses(
        (status = 200, description = "Verification email sent"),
        (status = 401, description = "No auth data found"),
        (status = 409, description = "Email is already verified")
    ),
    security(
        ("BearerAuth" = [])
    ),
)]
pub async fn resend_verification(
    AccessTokenClaim { sub, .. }: AccessTokenClaim,
    State(state): State<AccountState>,
) -> Result<(), LMSError> {
    state.account_service.resend_verification(sub).await
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

/// Update a user's role (admin only)
#[utoipa::path(
    patch,
    path = "/{user_id}/role",
    tag = "Account",
    params(
        ("user_id" = Uuid, Path)
    ),
    request_body = UpdateUserRoleDTO,
    responses(
        (status = 200, body = GetUserResponseDTO, description = "Successfully updated user role"),
        (status = 401, description = "No auth data found"),
        (status = 403, description = "Only admins can manage user roles"),
        (status = 404, description = "No user found with that ID")
    ),
    security(
        ("BearerAuth" = [])
    )
)]
pub async fn update_user_role(
    AccessTokenClaim { role, .. }: AccessTokenClaim,
    Path(user_id): Path<Uuid>,
    State(state): State<AccountState>,
    Json(payload): Json<UpdateUserRoleDTO>,
) -> Result<Json<GetUserResponseDTO>, LMSError> {
    if role != UserRole::Admin {
        return Err(LMSError::Forbidden(
            "Only admins can manage user roles".into(),
        ));
    }

    let user = state
        .account_service
        .set_user_role(user_id, payload.role)
        .await?;

    Ok(Json(user.into()))
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
    description = "List accounts with optional search. Limit <= 100.",
    params(
        ("limit" = i32, Query),
        ("offset" = i32, Query),
        ("search" = Option<String>, Query, description = "Substring match on username or email")
    ),
    responses(
        (status = 200, description = "Successfully got accounts page", body = PagedAccountsDTO),
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
    ValidatedQuery(query): ValidatedQuery<AccountListQuery>,
) -> Result<Json<PagedAccountsDTO>, LMSError> {
    if role != UserRole::Admin {
        return Err(LMSError::Forbidden("Only admins can list accounts".into()));
    }

    let (users, total) = state
        .account_service
        .list_accounts(query.limit, query.offset, query.search)
        .await?;

    Ok(Json(PagedAccountsDTO {
        total,
        users: users.into_iter().map(Into::into).collect(),
    }))
}
