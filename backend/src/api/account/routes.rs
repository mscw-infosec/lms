use crate::dto::account::CtfdStatus;
use crate::{
    api::account::AccountState,
    domain::account::model::UserModel,
    dto::account::{AvatarUploadResponse, GetUserResponseDTO},
    errors::LMSError,
    infrastructure::jwt::AccessTokenClaim,
};
use axum::{Json, extract::State};

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
