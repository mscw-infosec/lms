use crate::{
    api::account::AccountState,
    domain::account::model::UserModel,
    dto::account::{AvatarUploadResponse, GetUserResponseDTO},
    errors::LMSError,
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
    user: UserModel,
    State(state): State<AccountState>,
) -> Result<Json<AvatarUploadResponse>, LMSError> {
    let presigned = state.account_service.presigned_url(user.id).await?;
    Ok(Json(presigned.into()))
}
